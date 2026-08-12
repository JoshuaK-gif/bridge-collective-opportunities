echo "=== CPU ==="
nproc
lscpu | grep "Model name"

echo "=== RAM ==="
free -h

echo "=== GPU ==="
lspci 2>/dev/null | grep -iE "vga|3d|nvidia|amd" || echo "No GPU found"

echo "=== DISK ==="
df -h /

echo "=== SWAP ==="
swapon --show 2>/dev/null || echo "No swap"
