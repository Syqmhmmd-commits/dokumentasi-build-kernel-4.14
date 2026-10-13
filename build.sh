#!/usr/bin/env bash
# build.sh - build + packing kernel Rosemary (KernelSU Next / Non-KSU)
# Pakai : ./build.sh ksu     -> kernel dengan KernelSU Next (manual hook)
#         ./build.sh nonksu  -> kernel tanpa KernelSU
# Path bisa diganti lewat environment, contoh: TC=$HOME/clang ./build.sh ksu
set -euo pipefail

MODE="${1:-}"
KERNEL_DIR="${KERNEL_DIR:-$HOME/android/android_kernel_xiaomi_rosemary}"
TC="${TC:-$HOME/toolchain/proton-clang}"
AK_DIR="${AK_DIR:-$HOME/android/AnyKernel3-KSU}"
DEFCONFIG="${DEFCONFIG:-rosemary_defconfig}"

case "$MODE" in
  ksu)    OUT=out-ksun;   TAG=ksun ;;
  nonksu) OUT=out-nonksu; TAG=non  ;;
  *) echo "Pakai: $0 ksu|nonksu" >&2; exit 1 ;;
esac

[ -x "$TC/bin/clang" ] || { echo "Clang tidak ditemukan di $TC/bin" >&2; exit 1; }
[ -d "$AK_DIR" ]       || { echo "Folder AnyKernel tidak ada: $AK_DIR" >&2; exit 1; }

# Environment harus siap SEBELUM generate .config
export PATH="$TC/bin:$PATH"
export LD_LIBRARY_PATH="$TC/lib${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export ARCH=arm64 SUBARCH=arm64
export CROSS_COMPILE="$TC/aarch64-linux-gnu/bin/aarch64-linux-gnu-"
export CROSS_COMPILE_ARM32="$TC/arm-linux-gnueabi/bin/arm-linux-gnueabi-"
export LLVM=1 LLVM_IAS=1

MAKE_ARGS=(O="$OUT" ARCH=arm64 CC=clang HOSTCC=clang HOSTCXX=clang++)

cd "$KERNEL_DIR"
touch .scmversion
rm -rf "$OUT"

echo ">> [$MODE] generate .config"
make "${MAKE_ARGS[@]}" "$DEFCONFIG"

if [ "$MODE" = nonksu ]; then
  # Matikan KSU lewat .config, defconfig di repo tidak disentuh
  scripts/config --file "$OUT/.config" -d KSU
  make "${MAKE_ARGS[@]}" olddefconfig
  if grep -q '^CONFIG_KSU=y' "$OUT/.config"; then
    echo "CONFIG_KSU masih aktif, batal." >&2
    exit 1
  fi
else
  if ! grep -q '^CONFIG_KSU=y' "$OUT/.config"; then
    echo "CONFIG_KSU tidak aktif di .config, cek langkah 2-4 di dokumentasi." >&2
    exit 1
  fi
  if grep -q '^CONFIG_KPROBES=y' "$OUT/.config"; then
    echo "PERINGATAN: CONFIG_KPROBES aktif, padahal manual hook seharusnya tanpa KPROBES." >&2
  fi
fi

echo ">> [$MODE] compile"
make "${MAKE_ARGS[@]}" -j"$(nproc)" 2>&1 | tee "build_${TAG}.log"

IMG="$OUT/arch/arm64/boot/Image.gz-dtb"
[ -f "$IMG" ] || { echo "Build gagal: $IMG tidak ada. Cek build_${TAG}.log" >&2; exit 1; }

echo ">> [$MODE] packing"
cp "$IMG" "$AK_DIR/"
ZIP="Zenith-Rosemary-${TAG}-$(date +%Y%m%d).zip"
cd "$AK_DIR"
rm -f "$ZIP"
zip -r9 "$ZIP" * -x "*.zip"
echo ">> Selesai: $AK_DIR/$ZIP"