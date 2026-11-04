"""Installs the downloaded MakeHuman asset packs into MPFB's user data folder, exactly what MPFB's
"Install asset pack" button does, using MPFB's own extraction code.

Run with Blender 5.2 from the repository root, WITHOUT --factory-startup (the MPFB extension must load):
  blender -b --python-exit-code 1 --python assets/blender/install_mpfb_packs.py

Packs come from assets/source/makehuman (downloaded by assets/tools/fetch_assets.mjs, see assets/provenance.json).
Installing twice is harmless: files are copied over with the same content.
"""

import sys
from pathlib import Path

from bl_ext.user_default.mpfb.services import AssetService, LocationService

ROOT = Path(__file__).resolve().parents[2]
PACKS = sorted((ROOT / 'assets' / 'source' / 'makehuman').glob('*.zip'))


def main():
    if not PACKS:
        raise RuntimeError('no packs in assets/source/makehuman; run node assets/tools/fetch_assets.mjs people first')
    target = LocationService.get_user_data()
    print(f'MPFB user data: {target}')
    for zip_path in PACKS:
        problem = AssetService.check_asset_pack_zip(str(zip_path))
        if problem not in (None, 'STRUCTURE', 'MACOS'):
            raise RuntimeError(f'{zip_path.name} is not an asset pack: {problem}')
        failed = AssetService.fix_and_extract_asset_pack_zip(str(zip_path), target)
        if failed:
            raise RuntimeError(f'{zip_path.name} did not install: {failed}')
        print(f'installed {zip_path.name}')
    AssetService.rescan_pack_metadata()
    AssetService.update_all_asset_lists()
    print(f'packs known to MPFB: {AssetService.get_pack_names()}')
    print(f'system assets installed: {AssetService.system_assets_pack_is_installed()}')


try:
    main()
except Exception as exc:  # a nonzero exit is what --python-exit-code reports
    print(f'install failed: {exc}')
    sys.exit(1)
