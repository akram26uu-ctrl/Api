/**
 * ORDIUM Risk Features & Signals Intelligence Service
 * Provides feature definitions, heuristic weights, and attribution schemas.
 */

import { API_CONFIG, ordiumFetch } from './client';
import { RiskFeature } from './types';

export const featuresApi = {
  async listFeatures(): Promise<RiskFeature[]> {
    if (API_CONFIG.baseUrl) {
      return ordiumFetch<RiskFeature[]>('/risk-features');
    }

    return [
      {
        key: 'TOR_EXIT_NODE',
        name: 'Tor Exit Node / Anonymizing Proxy',
        category: 'network',
        description: 'Connection originates from known Tor relay or bulletproof proxy network.',
        type: 'boolean',
        weight: 35,
        importance: 0.94
      },
      {
        key: 'DEVICE_FINGERPRINT_REUSE',
        name: 'Cross-Account Device Collision',
        category: 'identity',
        description: 'Device canvas/WebGL fingerprint linked to multiple unrelated customer emails.',
        type: 'numeric',
        weight: 30,
        importance: 0.88
      },
      {
        key: 'IP_VELOCITY_BURST',
        name: 'IP Velocity Surge',
        category: 'velocity',
        description: 'Disproportionate order submission rate from the same /24 CIDR subnet in 15 minutes.',
        type: 'numeric',
        weight: 25,
        importance: 0.82
      },
      {
        key: 'CARD_BIN_GEO_MISMATCH',
        name: 'Card Issuing Country vs Shipping Country Mismatch',
        category: 'behavioral',
        description: 'Payment card issuer country contradicts destination delivery territory.',
        type: 'boolean',
        weight: 20,
        importance: 0.76
      },
      {
        key: 'HIGH_CANCELLATION_HISTORY',
        name: 'Address Chargeback / Cancellation History',
        category: 'historical',
        description: 'Shipping destination associated with previous disputed transactions.',
        type: 'numeric',
        weight: 15,
        importance: 0.71
      }
    ];
  }
};
