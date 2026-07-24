---
name: omni-mesh-redundancy
description: Installs and configures an unbreakable 4-way redundant mesh connection (Tailscale, Tor, Tmate, ZeroTier) with autonomous self-healing Watchdogs on any Linux/Windows node.
---

# Omni-Mesh Redundancy (La Hidra de 4 Cabezas)

Use this skill when the user asks to "make a server unbreakable", "setup redundancy", "install the hydra", or when adding a new node to the Antigravity Manager mesh.

## The 4 Pathways
A fully fortified node MUST have the following 4 independent pathways running simultaneously:
1. **Tailscale Mesh (Vía 1):** The primary commercial P2P mesh network.
2. **Tor Hidden Service (Vía 2):** A completely decentralized Darknet `.onion` address that pierces firewalls and NATs.
3. **Tmate Reverse Shell (Vía 3):** An instant public TCP reverse tunnel that can be accessed globally via standard SSH.
4. **ZeroTier One (Vía 4):** A secondary commercial P2P mesh network that acts as a fallback if Tailscale's global auth servers go down.

## Autonomous Watchdog (Auto-Healer)
A local daemon called `omni-watchdog` must be installed on the node.
- It continuously pings the central VPS Tailscale IP (e.g., `100.87.67.83`).
- If it fails consecutively, it autonomously runs `systemctl restart tailscaled` and flushes `iptables` to revive itself without external pivot nodes.

## Implementation Steps for Agents
When invoking this skill, you must:
1. **Generate SSH Keys**: Ensure the node has `~/.ssh/id_rsa`.
2. **Install Tor**: `apt-get install tor`, configure `/etc/tor/torrc` with `HiddenServiceDir` and `HiddenServicePort 22`, restart Tor, and read `/var/lib/tor/hidden_service/hostname`.
3. **Install Tmate**: `apt-get install tmate`, launch a headless session (`tmate -S /tmp/tmate.sock new-session -d`), and read the SSH string (`tmate -S /tmp/tmate.sock display -p '#{tmate_ssh}'`).
4. **Deploy Omni-Watchdog**: Write a ping-loop script to `/usr/local/bin/omni-watchdog.sh` and set it up as an always-on `systemd` service.
5. **Install ZeroTier**: `curl -s https://install.zerotier.com | sudo bash`.

Ensure you record the Tor Address and Tmate Address and present them to the user.
