//! Local document engine. Native handles never cross the IPC boundary.
pub const PRODUCT_NAME: &str = "Papier";
pub mod engine;
pub mod library;
pub mod native_tools;
pub mod session;
pub mod signatures;
pub mod structure;
pub mod workspace;
pub type Result<T> = std::result::Result<T, Box<dyn std::error::Error + Send + Sync>>;

pub fn fail<T>(message: &str) -> Result<T> {
    Err(message.to_owned().into())
}
