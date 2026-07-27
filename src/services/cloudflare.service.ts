import fs from 'fs';
import path from 'path';
import { z } from 'zod';

// Configuración de la bóveda
const VAULT_PATH = path.resolve('C:/ProyectoCiverCloudUnificado/Respaldos-y-Sync/mesh-shared-vault/secrets/CREDENTIALS_DB.json');

// Esquema de validación para las credenciales
const CredentialsSchema = z.object({
  cloudflare: z.object({
    api_token: z.string().optional(),
    api_key: z.string().optional(),
    email: z.string().optional(),
  }).optional(),
}).passthrough();

export class CloudflareService {
  private static instance: CloudflareService;
  private apiToken: string | null = null;
  private apiKey: string | null = null;
  private email: string | null = null;
  private baseUrl = 'https://api.cloudflare.com/client/v4';

  private constructor() {
    this.loadCredentials();
  }

  public static getInstance(): CloudflareService {
    if (!CloudflareService.instance) {
      CloudflareService.instance = new CloudflareService();
    }
    return CloudflareService.instance;
  }

  private loadCredentials() {
    try {
      if (fs.existsSync(VAULT_PATH)) {
        const data = fs.readFileSync(VAULT_PATH, 'utf-8');
        const parsed = JSON.parse(data);
        const credentials = CredentialsSchema.parse(parsed);

        if (credentials.cloudflare) {
          this.apiToken = credentials.cloudflare.api_token || null;
          this.apiKey = credentials.cloudflare.api_key || null;
          this.email = credentials.cloudflare.email || null;
        }
      } else {
        console.warn(`[CloudflareService] No se encontró la bóveda en: ${VAULT_PATH}`);
      }
    } catch (error) {
      console.error('[CloudflareService] Error al cargar credenciales:', error);
    }
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.apiToken) {
      headers['Authorization'] = `Bearer ${this.apiToken}`;
    } else if (this.apiKey && this.email) {
      headers['X-Auth-Key'] = this.apiKey;
      headers['X-Auth-Email'] = this.email;
    } else {
      throw new Error('No hay credenciales válidas de Cloudflare configuradas en CREDENTIALS_DB.json');
    }

    return headers;
  }

  /**
   * Obtiene la lista de zonas (dominios) en Cloudflare
   */
  public async getZones() {
    const response = await fetch(`${this.baseUrl}/zones`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Error al obtener zonas: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Obtiene los registros DNS de una zona específica
   */
  public async getDnsRecords(zoneId: string) {
    const response = await fetch(`${this.baseUrl}/zones/${zoneId}/dns_records`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      throw new Error(`Error al obtener registros DNS: ${response.statusText}`);
    }

    return response.json();
  }
}

export const cloudflareService = CloudflareService.getInstance();
