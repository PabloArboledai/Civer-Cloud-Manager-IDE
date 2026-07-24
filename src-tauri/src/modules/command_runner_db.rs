use rusqlite::{params, Connection};
use std::path::PathBuf;
use chrono::Utc;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct CommandLog {
    pub id: String,
    pub node_ip: String,
    pub command_text: String,
    pub status: String, // PENDING, RUNNING, DISCONNECTED, COMPLETED, FAILED
    pub stdout: Option<String>,
    pub stderr: Option<String>,
    pub timestamp: i64,
}

pub fn get_db_path() -> Result<PathBuf, String> {
    let data_dir = crate::modules::account::get_data_dir()?;
    Ok(data_dir.join("command_runner.db"))
}

fn connect_db() -> Result<Connection, String> {
    let db_path = get_db_path()?;
    let conn = Connection::open(db_path).map_err(|e| e.to_string())?;

    conn.pragma_update(None, "journal_mode", "WAL").map_err(|e| e.to_string())?;
    conn.pragma_update(None, "busy_timeout", 5000).map_err(|e| e.to_string())?;
    conn.pragma_update(None, "synchronous", "NORMAL").map_err(|e| e.to_string())?;

    Ok(conn)
}

pub fn init_db() -> Result<(), String> {
    let conn = connect_db()?;
    conn.execute(
        "CREATE TABLE IF NOT EXISTS commands_queue (
            id TEXT PRIMARY KEY,
            node_ip TEXT,
            command_text TEXT,
            status TEXT,
            stdout TEXT,
            stderr TEXT,
            timestamp INTEGER
        )",
        [],
    ).map_err(|e| e.to_string())?;
    
    // Index for quick status checks (e.g. finding PENDING or DISCONNECTED tasks)
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_status ON commands_queue (status)",
        [],
    ).map_err(|e| e.to_string())?;
    
    // Index for node IP
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_node ON commands_queue (node_ip)",
        [],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

pub fn insert_command(id: &str, node_ip: &str, command_text: &str) -> Result<(), String> {
    let conn = connect_db()?;
    let timestamp = Utc::now().timestamp();
    
    conn.execute(
        "INSERT INTO commands_queue (id, node_ip, command_text, status, timestamp) 
         VALUES (?1, ?2, ?3, 'PENDING', ?4)",
        params![id, node_ip, command_text, timestamp],
    ).map_err(|e| e.to_string())?;
    
    Ok(())
}

pub fn update_command_status(id: &str, status: &str, stdout: Option<&str>, stderr: Option<&str>) -> Result<(), String> {
    let conn = connect_db()?;
    
    conn.execute(
        "UPDATE commands_queue SET status = ?1, stdout = COALESCE(?2, stdout), stderr = COALESCE(?3, stderr) WHERE id = ?4",
        params![status, stdout, stderr, id],
    ).map_err(|e| e.to_string())?;
    
    Ok(())
}

pub fn get_commands_by_status(status: &str) -> Result<Vec<CommandLog>, String> {
    let conn = connect_db()?;
    let mut stmt = conn.prepare("SELECT id, node_ip, command_text, status, stdout, stderr, timestamp FROM commands_queue WHERE status = ?1 ORDER BY timestamp ASC").map_err(|e| e.to_string())?;
    
    let iter = stmt.query_map([status], |row| {
        Ok(CommandLog {
            id: row.get(0)?,
            node_ip: row.get(1)?,
            command_text: row.get(2)?,
            status: row.get(3)?,
            stdout: row.get(4).unwrap_or(None),
            stderr: row.get(5).unwrap_or(None),
            timestamp: row.get(6)?,
        })
    }).map_err(|e| e.to_string())?;
    
    let mut logs = Vec::new();
    for log in iter {
        logs.push(log.map_err(|e| e.to_string())?);
    }
    
    Ok(logs)
}

pub fn mark_running_as_disconnected(node_ip: &str) -> Result<(), String> {
    let conn = connect_db()?;
    conn.execute(
        "UPDATE commands_queue SET status = 'DISCONNECTED' WHERE node_ip = ?1 AND status = 'RUNNING'",
        params![node_ip],
    ).map_err(|e| e.to_string())?;
    
    Ok(())
}
