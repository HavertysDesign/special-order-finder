"""Dominant product colors from a photo: drops the studio background, clusters the rest in Lab.
Returns up to 3 (L, a, b, share) tuples, biggest first, packed as 12 bytes."""
import numpy as np
from PIL import Image

def _lab(rgb):
    c = rgb / 255.0
    c = np.where(c > 0.04045, ((c + 0.055) / 1.055) ** 2.4, c / 12.92)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = c @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[:, 1] - 16, 500 * (f[:, 0] - f[:, 1]), 200 * (f[:, 1] - f[:, 2])], 1)

def colors(im, k=4):
    im = im.convert('RGB').copy(); im.thumbnail((96, 96))
    a = np.asarray(im, dtype=np.float32); h, w, _ = a.shape
    border = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    bg = np.median(border, 0); spread = np.abs(border - bg).mean()
    px = a.reshape(-1, 3)
    if spread < 12:        # studio shot: keep what differs from the backdrop
        keep = np.abs(px - bg).max(1) > 22
    else:                  # room shot: the product is usually in the middle
        yy, xx = np.mgrid[0:h, 0:w]
        keep = ((np.abs(yy - h / 2) < h * 0.3) & (np.abs(xx - w / 2) < w * 0.3)).reshape(-1)
    px = px[keep]
    if len(px) < 30: px = a.reshape(-1, 3)
    lab = _lab(px)
    # k-means, seeded by lightness quantiles so runs are repeatable
    cen = lab[np.argsort(lab[:, 0])[np.linspace(0, len(lab) - 1, k).astype(int)]]
    for _ in range(8):
        d = ((lab[:, None, :] - cen[None]) ** 2).sum(2); lb = d.argmin(1)
        for j in range(k):
            if (lb == j).any(): cen[j] = lab[lb == j].mean(0)
    share = np.bincount(lb, minlength=k) / len(lb)
    o = np.argsort(-share)[:3]
    return [(float(cen[j, 0]), float(cen[j, 1]), float(cen[j, 2]), float(share[j])) for j in o]

def pack(cs):
    b = bytearray(12)
    for i, (L, A, B, s) in enumerate(cs[:3]):
        b[i * 4:i * 4 + 4] = bytes([int(np.clip(round(L * 2.55), 0, 255)), int(np.clip(round(A + 128), 0, 255)),
                                    int(np.clip(round(B + 128), 0, 255)), int(np.clip(round(s * 255), 0, 255))])
    return bytes(b)
