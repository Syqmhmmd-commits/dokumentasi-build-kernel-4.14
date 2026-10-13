# Dokumentasi Build Kernel Rosemary

Panduan build kernel **Redmi Note 10S / POCO M5s (Rosemary)** (4.14) dengan KernelSU Next (manual hook) atau tanpa KernelSU.

**Live:** https://syqmhmmd-commits.github.io/dokumentasi-build-kernel-4.14/

## Isi
- Cleanup, setup KernelSU Next, patch manual hook, defconfig
- Build, packing AnyKernel3, flash ke perangkat
- Build Non-KSU dan troubleshooting

## Build cepat
```bash
chmod +x build.sh
./build.sh ksu       # dengan KernelSU Next
./build.sh nonksu    # tanpa KernelSU
```

## Peringatan
Flash kernel custom berisiko bootloop. Backup boot.img dulu dan gunakan dengan risiko sendiri.
