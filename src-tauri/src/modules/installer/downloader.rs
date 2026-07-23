use reqwest;
use std::fs::File;
use std::io::Write;
use std::path::Path;

pub async fn download_binary(url: &str, destination: &Path) -> Result<(), String> {
    tracing::info!("Descargando dependencia dinámica desde: {}", url);
    
    let response = reqwest::get(url).await.map_err(|e| e.to_string())?;
    
    if !response.status().is_success() {
        return Err(format!("Fallo al descargar archivo. Código HTTP: {}", response.status()));
    }

    let bytes = response.bytes().await.map_err(|e| e.to_string())?;
    
    let mut file = File::create(destination).map_err(|e| e.to_string())?;
    file.write_all(&bytes).map_err(|e| e.to_string())?;
    
    tracing::info!("Descarga completada con éxito en: {:?}", destination);
    Ok(())
}
