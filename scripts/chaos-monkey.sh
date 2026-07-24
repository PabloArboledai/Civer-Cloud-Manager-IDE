#!/bin/bash
# Chaos Monkey: Antigravity Mesh Sabotage Script
# WARNING: This script intentionally disrupts network connectivity.
# It simulates severe network degradation (latency, packet loss, interface failure).

if [ "$EUID" -ne 0 ]; then
  echo "[-] Please run as root."
  exit 1
fi

IFACE=${1:-tailscale0}
ACTION=${2:-help}

echo "[*] Chaos Monkey 🐵 initialized on interface: $IFACE"

case "$ACTION" in
    drop)
        echo "[!] INITIATING THE DARK SILENCE (Dropping all traffic on $IFACE)"
        iptables -A INPUT -i $IFACE -j DROP
        iptables -A OUTPUT -o $IFACE -j DROP
        echo "[*] Waiting 60s before auto-healing..."
        sleep 60
        iptables -D INPUT -i $IFACE -j DROP
        iptables -D OUTPUT -o $IFACE -j DROP
        echo "[+] Traffic restored."
        ;;
    delay)
        echo "[!] INITIATING TIME DILATION (500ms latency on $IFACE)"
        tc qdisc add dev $IFACE root netem delay 500ms
        echo "[*] Waiting 60s before auto-healing..."
        sleep 60
        tc qdisc del dev $IFACE root
        echo "[+] Latency removed."
        ;;
    loss)
        echo "[!] INITIATING THE VOID (30% packet loss on $IFACE)"
        tc qdisc add dev $IFACE root netem loss 30%
        echo "[*] Waiting 60s before auto-healing..."
        sleep 60
        tc qdisc del dev $IFACE root
        echo "[+] Packet loss removed."
        ;;
    heal)
        echo "[+] FORCING HEAL PROTOCOL"
        iptables -F
        tc qdisc del dev $IFACE root 2>/dev/null
        systemctl restart tailscaled
        echo "[+] Node should be fully recovered."
        ;;
    *)
        echo "Usage: $0 [interface] [drop|delay|loss|heal]"
        echo "Example: $0 tailscale0 delay"
        exit 1
        ;;
esac
