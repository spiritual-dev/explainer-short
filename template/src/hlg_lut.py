# HLG (BT.2100, iPhone HDR video) -> SDR BT.709 3D LUT, for ffmpeg builds without zscale/libplacebo.
# Usage: python3 src/hlg_lut.py broll/hlg2sdr.cube [exposure]   (0.85 suited bright daylight woods; raise for shade)
# Input to the LUT: full-range R'G'B' in BT.2020 primaries, HLG-encoded. Output: BT.709 gamma-encoded R'G'B'.
# Chain: inverse HLG OETF -> HLG OOTF (1000 nit, system gamma 1.2) -> reference white (203 nit) = 1.0
#        -> soft highlight knee (luminance) -> BT.2020->BT.709 gamut -> BT.1886 inverse (gamma 2.4).
import numpy as np, sys
N = 65; a, b, c = 0.17883277, 0.28466892, 0.55991073
g = np.linspace(0, 1, N)
B_, G_, R_ = np.meshgrid(g, g, g, indexing='ij')          # .cube order: R fastest
E = np.stack([R_, G_, B_], -1)
lin = np.where(E <= 0.5, E ** 2 / 3, (np.exp((E - c) / a) + b) / 12)
Ys = lin @ np.array([0.2627, 0.6780, 0.0593])
disp = lin * (np.maximum(Ys, 1e-6) ** 0.2)[..., None] * 1000 / 203     # display light, ref white = 1
EXPO = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0
disp *= EXPO
Y = disp @ np.array([0.2627, 0.6780, 0.0593])
k = 0.72
Yt = np.where(Y <= k, Y, k + (1 - k) * np.tanh((Y - k) / (1 - k)))
disp = disp * (Yt / np.maximum(Y, 1e-6))[..., None]
M = np.array([[1.6605, -0.5876, -0.0728], [-0.1246, 1.1329, -0.0083], [-0.0182, -0.1006, 1.1187]])
rgb = disp @ M.T
Y2 = rgb @ np.array([0.2126, 0.7152, 0.0722])
neg = np.minimum(rgb.min(-1), 0)                           # pull out-of-gamut toward grey instead of clipping hue
t = np.where(neg < 0, neg / np.minimum(neg - Y2[...] , -1e-6), 0)
rgb = rgb + (Y2[..., None] - rgb) * t[..., None]
out = np.clip(rgb, 0, 1) ** (1 / 2.4)
with open(sys.argv[1], 'w') as f:
    f.write(f'LUT_3D_SIZE {N}\n')
    for v in out.reshape(-1, 3): f.write(f'{v[0]:.6f} {v[1]:.6f} {v[2]:.6f}\n')
