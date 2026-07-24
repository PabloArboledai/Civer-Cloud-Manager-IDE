---
name: omni-mesh-chaos
description: Executes chaos engineering experiments on mesh nodes to verify redundancy, autonomous self-healing, and structural resilience.
---

# Omni-Mesh Chaos (Chaos Engineering)

Use this skill when the user asks to "execute chaos experiments", "melt the connections", "test the mesh resilience", or "verify the watchdog".

## Core Philosophy
Before unleashing chaos, you MUST verify that the node has at least 3 independent connection pathways established (e.g., Tailscale, Tor, Tmate). Never cut a network interface without having a backdoor.

## Chaos Protocols
This skill encompasses the following destructive tests:

1. **The Dark Silence (Tailscale Drop)**
   - Simulates a total collapse of the primary mesh.
   - Command: `iptables -A INPUT -i tailscale0 -j DROP && iptables -A OUTPUT -o tailscale0 -j DROP`
   - Verification: The agent's SSH session will freeze. The agent must verify if the local `omni-watchdog` flushes the iptables and restores the connection within 2 minutes.

2. **The Time Dilation (Latency Injection)**
   - Injects extreme artificial latency to test UI and backend timeout thresholds.
   - Command: `tc qdisc add dev tailscale0 root netem delay 500ms`
   - Verification: Ping the node. Latency should jump from ~20ms to ~500ms. Test if Antigravity Manager handles the delay gracefully without crashing.
   - Recovery: `tc qdisc del dev tailscale0 root`

3. **The Void (Packet Loss Simulation)**
   - Drops 30% of packets randomly to simulate degraded network environments (e.g., mobile connections or satellite).
   - Command: `tc qdisc add dev tailscale0 root netem loss 30%`
   - Recovery: `tc qdisc del dev tailscale0 root`

## Execution Rules
Always write these chaos tests into a script (`/tmp/chaos_test.sh`) with an automatic `sleep` and recovery mechanism baked into the script so the node doesn't permanently brick itself if the watchdog fails.
Example:
```bash
#!/bin/bash
tc qdisc add dev tailscale0 root netem delay 500ms
sleep 60
tc qdisc del dev tailscale0 root
```
