"""
Bake the wrestler base model from MakeHuman (CC0) assets with Blender + MPFB2.

    blender -b --python scripts/blender/bake_human.py -- public/models

Writes `human.bin` (one binary blob with a JSON header) plus textures:
  - body mesh: positions, triangles, per-corner UVs, 4 skin weights per vertex
  - skeleton: the MPFB "game_engine" rig (fingers included), renamed to the runtime's bone names
  - morphs: sparse, quantised deltas for macro variants (muscle, weight, proportions, age, race)
    and detail targets (jaw, chin, cheeks, nose, brows, eyes, lips, ears, head shapes, torso, limbs)
  - parts: eyes, eyebrows, eyelashes and hair meshes, each bound to its nearest body vertex
  - textures: skin detail maps, eyebrow / eyelash / hair alpha maps, iris

Coordinates are converted from Blender (Z up, character facing -Y) to the game (Y up, facing +Z).
Requires the MPFB extension and the MakeHuman system asset pack.
"""
import json
import math
import os
import struct
import sys

import bpy
import numpy as np
from mathutils import Matrix, Vector
from mathutils.kdtree import KDTree

from bl_ext.user_default.mpfb.entities.objectproperties import HumanObjectProperties
from bl_ext.user_default.mpfb.services.humanservice import HumanService
from bl_ext.user_default.mpfb.services.locationservice import LocationService
from bl_ext.user_default.mpfb.services.targetservice import TargetService

OUT = os.path.abspath(sys.argv[sys.argv.index("--") + 1])
os.makedirs(OUT, exist_ok=True)
DATA = LocationService.get_user_data()
TARGETS = LocationService.get_mpfb_data("targets")

# Z-up (Blender) → Y-up (game): (x, y, z) → (x, z, -y)
C = Matrix.Rotation(-math.pi / 2, 4, "X")

BONE_NAMES = {
    "pelvis": "spine", "spine_01": "spine001", "spine_02": "spine002", "spine_03": "spine003",
    "neck_01": "spine004", "head": "spine005",
}
for s, S in (("l", "L"), ("r", "R")):
    BONE_NAMES.update({
        f"clavicle_{s}": f"shoulder{S}", f"upperarm_{s}": f"upper_arm{S}", f"lowerarm_{s}": f"forearm{S}",
        f"hand_{s}": f"hand{S}", f"thigh_{s}": f"thigh{S}", f"calf_{s}": f"shin{S}", f"foot_{s}": f"foot{S}",
        f"ball_{s}": f"toe{S}",
    })
    for j in (1, 2, 3):
        BONE_NAMES[f"thumb_0{j}_{s}"] = f"thumb0{j}{S}"
        for f in ("index", "middle", "ring", "pinky"):
            BONE_NAMES[f"{f}_0{j}_{s}"] = f"f_{f}0{j}{S}"

# Morphs: name → list of (target path, weight). Bipolar sliders are two morphs: name+ / name-.
def lr(path):
    return [(path.replace("{s}", "l"), 1.0), (path.replace("{s}", "r"), 1.0)]

DETAIL = {}
def bipolar(name, incr, decr):
    DETAIL[name + "+"] = incr
    DETAIL[name + "-"] = decr

bipolar("jaw", [("chin/chin-width-incr", 1)], [("chin/chin-width-decr", 1)])
bipolar("chin", [("chin/chin-prominent-incr", 1)], [("chin/chin-prominent-decr", 1)])
bipolar("chinHeight", [("chin/chin-height-incr", 1)], [("chin/chin-height-decr", 1)])
bipolar("jawBones", [("chin/chin-bones-incr", 1)], [("chin/chin-bones-decr", 1)])
bipolar("cheekBones", lr("cheek/{s}-cheek-bones-incr"), lr("cheek/{s}-cheek-bones-decr"))
bipolar("cheekVolume", lr("cheek/{s}-cheek-volume-incr"), lr("cheek/{s}-cheek-volume-decr"))
bipolar("noseSize", [("nose/nose-scale-horiz-incr", 1), ("nose/nose-scale-vert-incr", 1)], [("nose/nose-scale-horiz-decr", 1), ("nose/nose-scale-vert-decr", 1)])
bipolar("noseHump", [("nose/nose-hump-incr", 1)], [("nose/nose-hump-decr", 1)])
bipolar("noseFlare", [("nose/nose-flaring-incr", 1)], [("nose/nose-flaring-decr", 1)])
bipolar("noseTip", [("nose/nose-point-up", 1)], [("nose/nose-point-down", 1)])
bipolar("browDepth", [("eyebrows/eyebrows-trans-forward", 1)], [("eyebrows/eyebrows-trans-backward", 1)])
bipolar("browAngle", [("eyebrows/eyebrows-angle-up", 1)], [("eyebrows/eyebrows-angle-down", 1)])
bipolar("eyeSize", lr("eyes/{s}-eye-scale-incr"), lr("eyes/{s}-eye-scale-decr"))
bipolar("eyeOpen", lr("eyes/{s}-eye-height2-incr"), lr("eyes/{s}-eye-height2-decr"))
bipolar("eyeBags", lr("eyes/{s}-eye-bag-incr"), lr("eyes/{s}-eye-bag-decr"))
bipolar("mouthWidth", [("mouth/mouth-scale-horiz-incr", 1)], [("mouth/mouth-scale-horiz-decr", 1)])
bipolar("lips", [("mouth/mouth-upperlip-volume-incr", 1), ("mouth/mouth-lowerlip-volume-incr", 1)], [("mouth/mouth-upperlip-volume-decr", 1), ("mouth/mouth-lowerlip-volume-decr", 1)])
bipolar("headWidth", [("head/head-scale-horiz-incr", 1)], [("head/head-scale-horiz-decr", 1)])
bipolar("headLength", [("head/head-scale-vert-incr", 1)], [("head/head-scale-vert-decr", 1)])
bipolar("headDepth", [("head/head-scale-depth-incr", 1)], [("head/head-scale-depth-decr", 1)])
bipolar("headFat", [("head/head-fat-incr", 1)], [("head/head-fat-decr", 1)])
bipolar("forehead", [("forehead/forehead-scale-vert-incr", 1)], [("forehead/forehead-scale-vert-decr", 1)])
bipolar("temples", [("forehead/forehead-temple-incr", 1)], [("forehead/forehead-temple-decr", 1)])
bipolar("ears", lr("ears/{s}-ear-scale-incr"), lr("ears/{s}-ear-scale-decr"))
for shape in ("square", "round", "oval", "triangular", "invertedtriangular", "diamond", "rectangular"):
    DETAIL["head_" + shape] = [(f"head/head-{shape}", 1)]
bipolar("neck", [("neck/neck-scale-horiz-incr", 1), ("neck/neck-scale-depth-incr", 1)], [("neck/neck-scale-horiz-decr", 1), ("neck/neck-scale-depth-decr", 1)])
DETAIL["neckDouble"] = [("neck/neck-double-incr", 1)]
bipolar("pecs", [("torso/torso-muscle-pectoral-incr", 1)], [("torso/torso-muscle-pectoral-decr", 1)])
bipolar("lats", [("torso/torso-muscle-dorsi-incr", 1)], [("torso/torso-muscle-dorsi-decr", 1)])
bipolar("vshape", [("torso/torso-vshape-incr", 1)], [("torso/torso-vshape-decr", 1)])
bipolar("shoulders", [("torso/measure-shoulder-dist-incr", 1)], [("torso/measure-shoulder-dist-decr", 1)])
bipolar("chest", [("torso/measure-bust-circ-incr", 1)], [("torso/measure-bust-circ-decr", 1)])
bipolar("waist", [("torso/measure-waist-circ-incr", 1)], [("torso/measure-waist-circ-decr", 1)])
bipolar("belly", [("stomach/stomach-pregnant-incr", 1)], [("stomach/stomach-pregnant-decr", 1)])
bipolar("abs", [("stomach/stomach-tone-incr", 1)], [("stomach/stomach-tone-decr", 1)])
bipolar("glutes", [("buttocks/buttocks-volume-incr", 1)], [("buttocks/buttocks-volume-decr", 1)])
bipolar("biceps", lr("arms/{s}-upperarm-muscle-incr"), lr("arms/{s}-upperarm-muscle-decr"))
bipolar("armFat", lr("arms/{s}-upperarm-fat-incr"), lr("arms/{s}-upperarm-fat-decr"))
bipolar("delts", lr("arms/{s}-upperarm-shoulder-muscle-incr"), lr("arms/{s}-upperarm-shoulder-muscle-decr"))
bipolar("forearms", lr("arms/{s}-lowerarm-muscle-incr"), lr("arms/{s}-lowerarm-muscle-decr"))
bipolar("thighs", lr("legs/{s}-upperleg-muscle-incr"), lr("legs/{s}-upperleg-muscle-decr"))
bipolar("thighFat", lr("legs/{s}-upperleg-fat-incr"), lr("legs/{s}-upperleg-fat-decr"))
bipolar("calves", lr("legs/{s}-lowerleg-muscle-incr"), lr("legs/{s}-lowerleg-muscle-decr"))

MACRO_BASE = {"gender": 1.0, "age": 0.5, "muscle": 0.5, "weight": 0.5, "proportions": 0.5, "height": 0.5, "cupsize": 0.5, "firmness": 0.5,
              "race": {"asian": 0.33, "caucasian": 0.34, "african": 0.33}}
MACRO_VARIANTS = {
    "muscle+": {"muscle": 1.0}, "muscle-": {"muscle": 0.0},
    "weight+": {"weight": 1.0}, "weight-": {"weight": 0.0},
    "proportions+": {"proportions": 1.0},
    "age+": {"age": 0.875}, "age-": {"age": 0.1875},
    "race_african": {"race": {"asian": 0.0, "caucasian": 0.0, "african": 1.0}},
    "race_asian": {"race": {"asian": 1.0, "caucasian": 0.0, "african": 0.0}},
    "race_caucasian": {"race": {"asian": 0.0, "caucasian": 1.0, "african": 0.0}},
}

PARTS = [
    ("eyes", "eyes/low-poly/low-poly.mhclo", "Eyes"),
    ("eyebrow_thick", "eyebrows/eyebrow001/eyebrow001.mhclo", "Eyebrows"),
    ("eyebrow_medium", "eyebrows/eyebrow006/eyebrow006.mhclo", "Eyebrows"),
    ("eyebrow_thin", "eyebrows/eyebrow010/eyebrow010.mhclo", "Eyebrows"),
    ("eyelashes", "eyelashes/eyelashes01/eyelashes01.mhclo", "Eyelashes"),
    ("hair_short", "hair/short02/short02.mhclo", "Hair"),
    ("hair_long", "hair/long01/long01.mhclo", "Hair"),
    ("hair_ponytail", "hair/ponytail01/ponytail01.mhclo", "Hair"),
]

TEXTURES = [
    ("skin_light", "skins/young_caucasian_male/young_lightskinned_male_diffuse.png", 1024, "JPEG"),
    ("skin_dark", "skins/young_african_male/young_darkskinned_male_diffuse.png", 1024, "JPEG"),
    ("eyebrow_thick", "eyebrows/eyebrow001/eyebrow001.png", 256, "PNG"),
    ("eyebrow_medium", "eyebrows/eyebrow006/eyebrow006.png", 256, "PNG"),
    ("eyebrow_thin", "eyebrows/eyebrow010/eyebrow010.png", 256, "PNG"),
    ("eyelashes", "eyelashes/eyelashes01/eyelashes01.png", 256, "PNG"),
    ("hair_short", "hair/short02/short02_diffuse.png", 512, "PNG"),
    ("hair_long", "hair/long01/long01_diffuse.png", 512, "PNG"),
    ("hair_ponytail", "hair/ponytail01/ponytail01_diffuse.png", 512, "PNG"),
    ("iris", "eyes/materials/brown_eye.png", 256, "PNG"),
]


def log(*a):
    print("[bake]", *a, flush=True)


# ── scene ──
for o in list(bpy.data.objects):
    bpy.data.objects.remove(o, do_unlink=True)

bm = HumanService.create_human(mask_helpers=True, detailed_helpers=True, extra_vertex_groups=True, feet_on_ground=True, scale=0.1, macro_detail_dict=json.loads(json.dumps(MACRO_BASE)))
mesh = bm.data
nv = len(mesh.vertices)
log("basemesh vertices", nv)


def set_macros(d):
    for k, v in d.items():
        if k == "race":
            for rk, rv in v.items():
                HumanObjectProperties.set_value(rk, rv, entity_reference=bm)
        else:
            HumanObjectProperties.set_value(k, v, entity_reference=bm)
    TargetService.reapply_macro_details(bm)


def mix_coords():
    k = bm.shape_key_add(name="__tmp", from_mix=True)
    a = np.empty(nv * 3, dtype=np.float64)
    k.data.foreach_get("co", a)
    bm.shape_key_remove(k)
    return a.reshape(-1, 3)


set_macros(MACRO_BASE)
base = mix_coords()

macro_deltas = {}
for name, change in MACRO_VARIANTS.items():
    m = json.loads(json.dumps(MACRO_BASE))
    for k, v in change.items():
        m[k] = v
    set_macros(m)
    macro_deltas[name] = mix_coords() - base
    log("macro", name, float(np.abs(macro_deltas[name]).max()))
set_macros(MACRO_BASE)

basis_key = bm.data.shape_keys.key_blocks[0]
basis = np.empty(nv * 3, dtype=np.float64)
basis_key.data.foreach_get("co", basis)
basis = basis.reshape(-1, 3)
detail_deltas = {}
for name, parts in DETAIL.items():
    total = np.zeros((nv, 3))
    for rel, w in parts:
        path = os.path.join(TARGETS, rel + ".target.gz")
        k = TargetService.load_target(bm, path, weight=0.0, name="__t")
        a = np.empty(nv * 3)
        k.data.foreach_get("co", a)
        bm.shape_key_remove(k)
        total += (a.reshape(-1, 3) - basis) * w
    detail_deltas[name] = total
log("detail targets", len(detail_deltas))

# ── rig ──
arm = HumanService.add_builtin_rig(bm, "game_engine", import_weights=True)
bpy.context.view_layer.update()
bone_names = [b.name for b in arm.data.bones if b.name in BONE_NAMES]
bone_index = {n: i for i, n in enumerate(bone_names)}
bones_out = []
for n in bone_names:
    b = arm.data.bones[n]
    M = C @ arm.matrix_world @ b.matrix_local
    parent = b.parent.name if b.parent and b.parent.name in BONE_NAMES else None
    bones_out.append({"name": BONE_NAMES[n], "parent": BONE_NAMES[parent] if parent else None, "matrix": [M[r][c] for c in range(4) for r in range(4)]})

# ── body: only vertices in the "body" group (helpers are masked) ──
body_group = bm.vertex_groups["body"].index
helper_groups = {g.index for g in bm.vertex_groups if g.name.startswith(("helper-", "joint-"))}
group_bone = {g.index: bone_index[g.name] for g in bm.vertex_groups if g.name in bone_index}
keep = []
weights = []
for v in mesh.vertices:
    in_body = False
    ws = []
    for g in v.groups:
        if g.group == body_group and g.weight > 0.5:
            in_body = True
        if g.group in helper_groups and g.weight > 0:
            in_body = False
            break
        if g.group in group_bone and g.weight > 0:
            ws.append((group_bone[g.group], g.weight))
    if in_body:
        keep.append(v.index)
        ws.sort(key=lambda x: -x[1])
        ws = ws[:4]
        s = sum(w for _, w in ws) or 1.0
        weights.append([(b, w / s) for b, w in ws] + [(0, 0.0)] * (4 - len(ws)))
remap = {old: new for new, old in enumerate(keep)}
log("body vertices", len(keep))

uv_layer = mesh.uv_layers.active.data
tris = []
corner_uv = []
for p in mesh.polygons:
    if not all(vi in remap for vi in p.vertices):
        continue
    loops = list(p.loop_indices)
    for k in range(1, len(loops) - 1):
        for li in (loops[0], loops[k], loops[k + 1]):
            tris.append(remap[mesh.loops[li].vertex_index])
            u, v = uv_layer[li].uv
            corner_uv.append((u, v))
log("body triangles", len(tris) // 3)


def to_game(arr):
    out = np.empty_like(arr)
    out[:, 0] = arr[:, 0]
    out[:, 1] = arr[:, 2]
    out[:, 2] = -arr[:, 1]
    return out


keep_np = np.array(keep)
base_body = to_game(base[keep_np])

# ── binary writer ──
blob = bytearray()
def put(arr, dtype):
    global blob
    while len(blob) % 4:
        blob += b"\0"
    a = np.ascontiguousarray(arr, dtype=dtype)
    off = len(blob)
    blob += a.tobytes()
    return {"offset": off, "count": int(a.size), "type": np.dtype(dtype).name}

header = {"version": 1, "bones": bones_out}
header["body"] = {
    "positions": put(base_body.ravel(), np.float32),
    "tris": put(np.array(tris), np.uint16),
    "uvs": put((np.clip(np.array(corner_uv), 0, 1) * 65535).round().ravel(), np.uint16),
    "skinIndex": put(np.array([[b for b, _ in w] for w in weights]).ravel(), np.uint8),
    "skinWeight": put((np.array([[w for _, w in ws] for ws in weights]) * 255).round().ravel(), np.uint8),
}

Q = 1e-4  # metres per quantisation step
morphs = []
for name, d in list(macro_deltas.items()) + list(detail_deltas.items()):
    dg = to_game(d[keep_np])
    mag = np.linalg.norm(dg, axis=1)
    idx = np.nonzero(mag > 2e-5)[0]
    q = np.clip(np.round(dg[idx] / Q), -32767, 32767)
    morphs.append({"name": name, "indices": put(idx, np.uint16), "deltas": put(q.ravel(), np.int16), "quant": Q})
header["morphs"] = morphs
log("morphs", len(morphs), "bytes so far", len(blob))

# ── parts (proxies) ──
kd = KDTree(len(keep))
for i, p in enumerate(base_body):
    kd.insert(Vector((p[0], p[1], p[2])), i)
kd.balance()
parts_out = []
for name, rel, kind in PARTS:
    before = set(bpy.data.objects)
    HumanService.add_mhclo_asset(os.path.join(DATA, rel), bm, asset_type=kind, subdiv_levels=0, material_type="MAKESKIN", set_up_rigging=False)
    new = [o for o in bpy.data.objects if o not in before and o.type == "MESH"]
    if not new:
        log("! part failed", name)
        continue
    ob = new[0]
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    me = ev.to_mesh()
    W = ob.matrix_world
    P = np.array([list(W @ v.co) for v in me.vertices])
    Pg = to_game(P)
    ptris = []
    puv = []
    uvl = me.uv_layers.active.data if me.uv_layers.active else None
    for poly in me.polygons:
        loops = list(poly.loop_indices)
        for k in range(1, len(loops) - 1):
            for li in (loops[0], loops[k], loops[k + 1]):
                ptris.append(me.loops[li].vertex_index)
                puv.append(tuple(uvl[li].uv) if uvl else (0.0, 0.0))
    bind = [kd.find(Vector(p))[1] for p in Pg]
    parts_out.append({
        "name": name, "kind": kind,
        "positions": put(Pg.ravel(), np.float32),
        "tris": put(np.array(ptris), np.uint32),
        "uvs": put((np.clip(np.array(puv), 0, 1) * 65535).round().ravel(), np.uint16),
        "bind": put(np.array(bind), np.uint16),
    })
    ev.to_mesh_clear()
    bpy.data.objects.remove(ob, do_unlink=True)
    log("part", name, len(P), "verts")
header["parts"] = parts_out

# ── textures ──
tex_out = {}
for name, rel, size, fmt in TEXTURES:
    src = os.path.join(DATA, rel)
    if not os.path.isfile(src):
        log("! missing texture", rel)
        continue
    img = bpy.data.images.load(src)
    if img.size[0] > size:
        img.scale(size, size)
    ext = "jpg" if fmt == "JPEG" else "png"
    fname = f"human_{name}.{ext}"
    img.filepath_raw = os.path.join(OUT, fname)
    img.file_format = fmt
    img.save()
    tex_out[name] = fname
header["textures"] = tex_out

js = json.dumps(header, separators=(",", ":")).encode()
while len(js) % 4:
    js += b" "
with open(os.path.join(OUT, "human.bin"), "wb") as f:
    f.write(b"RSHM")
    f.write(struct.pack("<I", len(js)))
    f.write(js)
    f.write(blob)
log("wrote human.bin", 8 + len(js) + len(blob), "bytes")
