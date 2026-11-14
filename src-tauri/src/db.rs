//! SQLite storage for download records and settings.
//!
//! Rust only stores and loads. A download record is the frontend's "recipe" (link, yt-dlp arguments,
//! title, status...) kept as a JSON document, so its shape is owned by `src/features/downloads/types.ts`.
//! yt-dlp's own `.part` files do the byte-level resuming; re-running a recipe resumes it.

use rusqlite::{Connection, params};
use std::path::Path;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

const SCHEMA_VERSION: i32 = 1;

pub struct Db(Mutex<Connection>);

impl Db {
    pub fn open(path: &Path) -> Result<Self, String> {
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        }
        let conn = Connection::open(path).map_err(|e| e.to_string())?;
        migrate(&conn).map_err(|e| e.to_string())?;
        Ok(Self(Mutex::new(conn)))
    }

    fn with<T>(&self, f: impl FnOnce(&Connection) -> rusqlite::Result<T>) -> Result<T, String> {
        let conn = self
            .0
            .lock()
            .map_err(|_| "database lock poisoned".to_string())?;
        f(&conn).map_err(|e| e.to_string())
    }
}

fn migrate(conn: &Connection) -> rusqlite::Result<()> {
    conn.pragma_update(None, "journal_mode", "WAL")?;
    let version: i32 = conn.pragma_query_value(None, "user_version", |r| r.get(0))?;
    if version < 1 {
        conn.execute_batch(
            "CREATE TABLE downloads (
                 id         TEXT PRIMARY KEY,
                 created_at INTEGER NOT NULL,
                 data       TEXT NOT NULL
             );
             CREATE TABLE settings (
                 key   TEXT PRIMARY KEY,
                 value TEXT NOT NULL
             );",
        )?;
    }
    conn.pragma_update(None, "user_version", SCHEMA_VERSION)
}

pub fn db_path(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(dir.join("tubegrab.db"))
}

/// All download records (JSON documents), oldest first.
#[tauri::command]
pub fn downloads_list(db: State<'_, Db>) -> Result<Vec<serde_json::Value>, String> {
    db.with(|c| {
        let mut stmt = c.prepare("SELECT data FROM downloads ORDER BY created_at, rowid")?;
        let rows = stmt.query_map([], |r| r.get::<_, String>(0))?;
        rows.map(|r| r.map(|s| serde_json::from_str(&s).unwrap_or(serde_json::Value::Null)))
            .collect()
    })
    .map(|v: Vec<_>| v.into_iter().filter(|x| !x.is_null()).collect())
}

/// Insert or replace records. Each needs a string `id` and a numeric `createdAt`.
#[tauri::command]
pub fn downloads_save(db: State<'_, Db>, records: Vec<serde_json::Value>) -> Result<(), String> {
    db.with(|c| {
        let tx = c.unchecked_transaction()?;
        {
            let mut stmt = tx.prepare(
                "INSERT INTO downloads (id, created_at, data) VALUES (?1, ?2, ?3)
                 ON CONFLICT(id) DO UPDATE SET data = excluded.data",
            )?;
            for r in &records {
                let id = r.get("id").and_then(|v| v.as_str()).unwrap_or_default();
                let created = r
                    .get("createdAt")
                    .and_then(|v| v.as_i64())
                    .unwrap_or_default();
                if !id.is_empty() {
                    stmt.execute(params![id, created, r.to_string()])?;
                }
            }
        }
        tx.commit()
    })
}

#[tauri::command]
pub fn downloads_delete(db: State<'_, Db>, ids: Vec<String>) -> Result<(), String> {
    db.with(|c| {
        let mut stmt = c.prepare("DELETE FROM downloads WHERE id = ?1")?;
        for id in &ids {
            stmt.execute([id])?;
        }
        Ok(())
    })
}

/// All settings as a JSON object `{ key: value }`.
#[tauri::command]
pub fn settings_load(
    db: State<'_, Db>,
) -> Result<serde_json::Map<String, serde_json::Value>, String> {
    db.with(|c| {
        let mut stmt = c.prepare("SELECT key, value FROM settings")?;
        let rows = stmt.query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?;
        let mut map = serde_json::Map::new();
        for row in rows {
            let (k, v) = row?;
            if let Ok(v) = serde_json::from_str(&v) {
                map.insert(k, v);
            }
        }
        Ok(map)
    })
}

#[tauri::command]
pub fn settings_save(
    db: State<'_, Db>,
    key: String,
    value: serde_json::Value,
) -> Result<(), String> {
    db.with(|c| {
        c.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value.to_string()],
        )
        .map(|_| ())
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrates_a_new_database() {
        let conn = Connection::open_in_memory().unwrap();
        migrate(&conn).unwrap();
        let v: i32 = conn
            .pragma_query_value(None, "user_version", |r| r.get(0))
            .unwrap();
        assert_eq!(v, SCHEMA_VERSION);
        // Running it again must be a no-op.
        migrate(&conn).unwrap();
    }
}
