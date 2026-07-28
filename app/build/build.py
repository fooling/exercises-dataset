# -*- coding: utf-8 -*-
"""把精选目录 catalog.py 与 data/exercises.json 合并，产出前端用的 app-data.json。

用法： python3 app/build/build.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from catalog import CATALOG, FAMILIES, DIFFICULTY, PARTS  # noqa: E402

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
SRC = os.path.join(ROOT, "data", "exercises.json")
OUT = os.path.join(ROOT, "app", "public", "data", "app-data.json")

# 未显式指定 std 时，按 (scheme, 难度) 给的兜底推荐组数
DEFAULT_STD = {
    ("rep", 1): ("1组×10次", "2组×20次", "3组×30次"),
    ("rep", 2): ("1组×8次", "2组×15次", "3组×25次"),
    ("rep", 3): ("1组×5次", "2组×12次", "3组×20次"),
    ("rep", 4): ("1组×3次", "2组×8次", "2组×12次"),
    ("rep", 5): ("1次", "3次", "2组×5次"),
    ("hold", 1): ("20秒", "45秒", "60秒"),
    ("hold", 2): ("20秒", "45秒", "90秒"),
    ("hold", 3): ("15秒", "30秒", "60秒"),
    ("hold", 4): ("10秒", "20秒", "40秒"),
    ("hold", 5): ("5秒", "10秒", "20秒"),
    ("time", 1): ("20秒×3轮", "30秒×4轮", "40秒×5轮"),
    ("time", 2): ("20秒×4轮", "30秒×5轮", "45秒×6轮"),
    ("time", 3): ("20秒×4轮", "30秒×6轮", "40秒×8轮"),
    ("time", 4): ("15秒×4轮", "20秒×6轮", "30秒×8轮"),
    ("time", 5): ("15秒×3轮", "20秒×4轮", "30秒×5轮"),
}

# 节奏与组间休息：教练处方的另外两个维度
TEMPO = {
    "rep": {
        1: "下放 2 秒 · 顶端停 1 秒 · 推起 1 秒",
        2: "下放 2 秒 · 顶端停 1 秒 · 推起 1 秒",
        3: "下放 3 秒 · 停 1 秒 · 发力 1 秒",
        4: "下放 3-4 秒 · 停 1 秒 · 全力发力",
        5: "全程最慢可控速度，宁可少做也不失控",
    },
    "hold": {
        1: "均匀呼吸，全程保持张力，不憋气",
        2: "均匀呼吸，全程保持张力，不憋气",
        3: "达到时间就停，宁可分多组也不要姿势变形",
        4: "姿势一变形立刻结束该组",
        5: "只做能保持标准形态的秒数，多组累积",
    },
    "time": {
        1: "中等节奏，能说完整句子",
        2: "快节奏，但动作质量优先于速度",
        3: "接近全力，质量下滑即结束该轮",
        4: "全力，轮间充分恢复",
        5: "全力，轮间充分恢复",
    },
}

REST = {1: "组间休息 30-45 秒", 2: "组间休息 45-60 秒", 3: "组间休息 60-90 秒",
        4: "组间休息 2-3 分钟", 5: "组间休息 3-5 分钟"}

FREQ = {1: "每周 3-5 次，几乎不会练过量", 2: "每周 3 次，隔天练",
        3: "每周 2-3 次，注意恢复", 4: "每周 2 次，保证 48 小时以上间隔",
        5: "每周 1-2 次，永远留有余力，绝不练到力竭"}

GOALS = ["打基础", "进阶", "精通"]

# 数据集的肌肉名是英文，这里统一中译
MUSCLE_ZH = {
    "abductors": "髋外展肌", "abs": "腹肌", "adductors": "内收肌",
    "ankle stabilizers": "踝稳定肌", "ankles": "踝关节", "back": "背部",
    "biceps": "肱二头肌", "calves": "小腿", "cardiovascular system": "心肺",
    "chest": "胸部", "core": "核心", "deltoids": "三角肌", "delts": "三角肌",
    "feet": "足部", "forearms": "前臂", "glutes": "臀大肌", "groin": "腹股沟",
    "hamstrings": "腘绳肌", "hands": "手部", "hip flexors": "髋屈肌",
    "lats": "背阔肌", "levator scapulae": "肩胛提肌", "lower abs": "下腹",
    "lower back": "下背", "obliques": "腹斜肌", "pectorals": "胸大肌",
    "quadriceps": "股四头肌", "quads": "股四头肌", "rear deltoids": "三角肌后束",
    "rhomboids": "菱形肌", "serratus anterior": "前锯肌", "shoulders": "肩部",
    "spine": "脊柱", "sternocleidomastoid": "胸锁乳突肌", "trapezius": "斜方肌",
    "traps": "斜方肌", "triceps": "肱三头肌", "upper back": "上背", "wrists": "腕关节",
}

# 数据集中文步骤是机翻，这些术语在徒手动作语境下是错的（顺序敏感，长的在前）
STEP_FIX = [
    ("杠铃或杠铃表面", "横杠"),
    ("杠铃或使用悬挂训练器", "横杠或悬挂带"),
    ("杠铃或悬吊训练器", "横杠或悬挂带"),
    ("杠铃或手柄", "横杠"),
    ("引体向上杆", "单杠"),
    ("杠铃杆", "横杠"),
    ("一个杠铃", "一根横杠"),
    ("杠铃", "横杠"),
    ("将肩胛骨挤压在一起", "肩胛骨向中间收紧"),
    ("肩胛骨挤压在一起", "肩胛骨向中间收紧"),
    ("重复所需的重复次数", "重复至目标次数"),
    ("所需的重复次数", "目标次数"),
]


def clean_step(s):
    for a, b in STEP_FIX:
        s = s.replace(a, b)
    return s


def zh_muscle(name):
    return MUSCLE_ZH.get(name, name)


def main():
    raw = json.load(open(SRC, encoding="utf-8"))
    by_id = {x["id"]: x for x in raw}

    seen, errors, out = set(), [], []
    for order, item in enumerate(CATALOG):
        eid = item["id"]
        if eid not in by_id:
            errors.append(f"ID 不存在于数据集: {eid} ({item['zh']})")
            continue
        if eid in seen:
            errors.append(f"重复收录: {eid} ({item['zh']})")
            continue
        seen.add(eid)

        src = by_id[eid]
        d, scheme = item["d"], item["scheme"]
        std = item["std"] or DEFAULT_STD[(scheme, d)]
        steps = src.get("instruction_steps", {}).get("zh") or []
        if not steps:
            zh = src.get("instructions", {}).get("zh", "")
            steps = [s.strip() for s in zh.split("。") if s.strip()]

        out.append({
            "_ord": order,
            "id": eid,
            "zh": item["zh"],
            "en": src["name"],
            "fam": item["fam"],
            "d": d,
            "parts": item["parts"],
            "cues": item["cues"],
            "errors": item["errors"],
            "scheme": scheme,
            "std": [{"goal": g, "text": t} for g, t in zip(GOALS, std)],
            "tempo": TEMPO[scheme][d],
            "rest": REST[d],
            "freq": FREQ[d],
            "note": item["note"],
            "need": item["need"] or "徒手",
            "steps": [clean_step(s) for s in steps],
            "gif": src["gif_url"],
            "img": src["image"],
            "target": zh_muscle(src.get("target", "")),
            "secondary": [zh_muscle(m) for m in src.get("secondary_muscles", [])],
        })

    if errors:
        print("构建失败：")
        for e in errors:
            print("  -", e)
        sys.exit(1)

    # 动作族内先按难度、同难度再按目录中编排的进阶顺序，形成阶梯
    fam_order = {f["key"]: i for i, f in enumerate(FAMILIES)}
    out.sort(key=lambda x: (fam_order[x["fam"]], x["d"], x["_ord"]))
    for f in FAMILIES:
        chain = [x for x in out if x["fam"] == f["key"]]
        for i, x in enumerate(chain):
            x["step"] = i + 1
            x["chain_len"] = len(chain)
    for x in out:
        del x["_ord"]

    payload = {
        "families": FAMILIES,
        "difficulty": DIFFICULTY,
        "parts": PARTS,
        "goals": GOALS,
        "exercises": out,
        "attribution": "动作图片/动图 © Gym visual — https://gymvisual.com/",
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))

    print(f"✅ 收录 {len(out)} 个动作 → {os.path.relpath(OUT, ROOT)}")
    for fam in FAMILIES:
        n = sum(1 for x in out if x["fam"] == fam["key"])
        print(f"   {fam['icon']} {fam['zh']:<6} {n:>3} 个")
    print(f"   文件大小 {os.path.getsize(OUT)/1024:.0f} KB")


if __name__ == "__main__":
    main()
