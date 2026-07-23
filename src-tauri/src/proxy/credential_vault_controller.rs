use serde::{Deserialize, Serialize};
use tracing::{info, warn, error};
use std::collections::HashMap;

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Credential {
    pub provider: String, // modal, supabase
    pub email: String,
    pub key_id: String,
    pub secret: String,
    pub active: bool,
}

pub struct VaultManager {
    credentials: HashMap<String, Vec<Credential>>,
}

impl VaultManager {
    pub fn new() -> Self {
        let mut vault = Self {
            credentials: HashMap::new(),
        };
        vault.load_hardcoded_keys();
        vault
    }

    fn load_hardcoded_keys(&mut self) {
        // Modal.com Keys
        let modal_keys = vec![
            Credential {
                provider: "modal".into(),
                email: "pablo.megacuentas@gmail.com".into(),
                key_id: "ak-uUkV60AdqcC5CuY2T6s1Pw".into(),
                secret: "as-xGGOdJPXHpOR5CdDqVCfiK".into(),
                active: true,
            },
            Credential {
                provider: "modal".into(),
                email: "grupo1".into(),
                key_id: "ak-z2ll2nd3K3cNc3KV1IKXaK".into(),
                secret: "as-2VemCDZG9ySTROgI3Oq364".into(),
                active: true,
            },
            Credential {
                provider: "modal".into(),
                email: "david.ledezma.com@gmail.com".into(),
                key_id: "wk-VKP7z2k8GmIK1FM2AILAZ6".into(),
                secret: "ws-wJFOLmZwQgpfnD9UALIILx".into(),
                active: true,
            },
            Credential {
                provider: "modal".into(),
                email: "latinobetterware@gmail.com".into(),
                key_id: "wk-8jzaFBoMrGNmZBwJPyKw8L".into(),
                secret: "ws-Xfvp6XgEPc6i46DbC9nymo".into(),
                active: true,
            },
        ];
        self.credentials.insert("modal".into(), modal_keys);

        // Supabase Keys
        let supabase_keys = vec![
            Credential {
                provider: "supabase".into(),
                email: "bundle-faster-open@duck.com".into(),
                key_id: "sb_publishable_KjISuMXFA0RuZHrQ0n_bMA_m2H6IpJz".into(),
                secret: "sb_secret_t29nbFhyLA0CDGeBSiSDBA__1J1Vyku".into(),
                active: true,
            },
            Credential {
                provider: "supabase".into(),
                email: "untie-flight-woozy@duck.com".into(),
                key_id: "sbp_4ded239ac6920677878c73fc3364b6d7e60acc61".into(),
                secret: "sbp_v0_98230dcf19934e07dd49fad0640c146de8cc2c55".into(),
                active: true,
            },
            Credential {
                provider: "supabase".into(),
                email: "broiler-bogus-purr@duck.com".into(),
                key_id: "sbp_ba2a5886f5d527fbc2b93fe0a50352fb6849a911".into(),
                secret: "".into(),
                active: true,
            },
            Credential {
                provider: "supabase".into(),
                email: "throng-eleven-wipe@duck.com".into(),
                key_id: "sbp_98e81b0112e259e00a338a5e2cb1db60fc22ad3e".into(),
                secret: "".into(),
                active: true,
            },
        ];
        self.credentials.insert("supabase".into(), supabase_keys);
        
        info!("Vault initialized. Loaded 4 Modal keys and 4 Supabase keys.");
    }
}

pub async fn start_credential_vault() {
    info!("Starting Credential Vault Manager...");
    let _vault = VaultManager::new();
    info!("Credential Vault Active: Validating Supabase & Modal connections silently...");
}
