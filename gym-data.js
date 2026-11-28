/**
 * Gym Plan 6 Buổi (Leg–Push–Pull) & 5 Buổi (PPL / UL) — Canonical Data v2, Analytics & 2-Way Merge Engine
 * Standalone browser script attaching window.GymPlan (zero ES module imports needed for PWA + SW).
 * 100% schema-aligned with canonical_v2_lpp_pplul.json, gym_data.json on GitHub Gist,
 * Desktop Frontend (gymPlanData.js), Backend (gymDatabaseService.js), and Excel (03_WEEKLY_REVIEW_DON_GIAN.xlsx).
 */
(function (root) {
  'use strict';

  const GYM_STORAGE_KEY = 'pcl_gym_data_v1';

  // Sunday of Week 1 (T1) — matches Sheet 1_Review_Cuoi_Tuan cell B11 (2026-11-01)
  const PLAN_START_SUNDAY = '2026-11-01';

  const DEFAULT_PLAN_MODE = 'lpp_6';

  const PLAN_MODES = {
    lpp_6: {
      id: 'lpp_6',
      label: '6 buổi · Leg–Push–Pull',
      shortLabel: '6 buổi LPP',
      sessionsPerWeek: 6,
      description: 'Đảo Chân lên T2 để tránh kẹt máy Ngực đầu tuần · Chu kỳ hồi phục chuẩn 72h · 100% máy cắm chốt & tạ đơn (0 cáp mặc định)',
      dayMap: {
        1: 'legs_a',
        2: 'push_a',
        3: 'pull_a',
        4: 'legs_b',
        5: 'push_b',
        6: 'pull_b',
        0: 'rest_sunday'
      }
    },
    ppl_ul_5: {
      id: 'ppl_ul_5',
      label: '5 buổi · PPL / UL',
      shortLabel: '5 buổi PPL/UL',
      sessionsPerWeek: 5,
      description: 'T2 Legs · T3 Push · T4 Pull · T5 Nghỉ giữa tuần · T6 Lower · T7 Upper · CN Nghỉ · Đủ 2 lần/tuần mỗi nhóm cơ khi bận',
      dayMap: {
        1: 'legs_a',
        2: 'push_a',
        3: 'pull_a',
        4: 'rest_midweek',
        5: 'ul_lower',
        6: 'ul_upper',
        0: 'rest_sunday'
      }
    }
  };

  // Verbatim InBody 270 baseline (25/10/2026) & 12-16 week 6-pack target
  const DEFAULT_BASELINE = {
    date: '2026-10-25',
    label: 'InBody 270 (25/10/2026)',
    gender: 'Nam',
    age: 23,
    heightCm: 172,
    weightKg: 70.6,
    smmKg: 32.2,
    fatKg: 13.9,
    pbf: 19.7,
    pbfPct: 19.7,
    trunkFatKg: 7.3,
    trunkFatPct: 178,
    visceralFatLevel: 5,
    whr: 0.89,
    inbodyScore: 77,
    leftLegPct: 98.1,
    rightLegPct: 99.4,
    waistCm: null,
    targetWeightKg: 67.2,
    targetSmmKg: 33.7,
    targetFatKg: 8.7,
    targetPbfPct: 12.9,
    targetTrunkFatKg: 4.5,
    targetInbodyScore: 83,
    updatedAt: 0
  };

  // Verbatim 6 daily habits from 04_CHECKLIST_HANG_NGAY_VA_AN_UONG.md
  const DAILY_HABITS_TEMPLATE = [
    {
      id: 'habit_workout',
      order: 1,
      category: 'workout',
      shortTitle: 'Tập đúng lịch',
      shortLabel: 'Tập / 8k bước',
      title: 'Tập đúng lịch hôm nay (hoặc đi bộ 8k+ bước ngày CN)',
      note: 'Hoàn thành buổi tập PPL A/B trong ngày (T2–T7) hoặc đi bộ phục hồi 8.000+ bước ngày Chủ Nhật.'
    },
    {
      id: 'habit_protein',
      order: 2,
      category: 'diet',
      shortTitle: 'Đủ 4 phần đạm',
      shortLabel: 'Đủ 4 phần đạm',
      title: 'Ăn đủ 4 phần đạm (thịt/cá/trứng/whey — mỗi bữa 1–1.5 lòng bàn tay)',
      note: 'Chia đều 4 lần/ngày (~135–145g đạm): Sáng – Trưa – Xế quanh giờ tập – Tối.'
    },
    {
      id: 'habit_carbs',
      order: 3,
      category: 'diet',
      shortTitle: 'Đúng tinh bột + rau',
      shortLabel: '1 chén cơm + rau',
      title: 'Đúng khẩu phần tinh bột (tối đa 1 chén cơm/bữa chính) + nhiều rau',
      note: 'Quy tắc đĩa 3 phần: 1/2 rau xanh · 1/4 đạm nạc · 1/4 tinh bột (ngày nghỉ CN giảm nửa chén cơm tối).'
    },
    {
      id: 'habit_no_liquid_cal',
      order: 4,
      category: 'diet',
      shortTitle: '0 calo lỏng',
      shortLabel: '0 calo lỏng',
      title: '0 calo lỏng (không trà sữa, nước ngọt, cà phê sữa đặc, ăn vặt khuya)',
      note: 'Đổi sang cà phê đen đá/Americano, trà không đường, nước lọc 2.5–3L hoặc nước ngọt 0 calo.'
    },
    {
      id: 'habit_steps_water',
      order: 5,
      category: 'recovery',
      shortTitle: '8k+ bước & 2.5–3L nước',
      shortLabel: '8k bước + 3L nước',
      title: 'Đủ vận động & nước (8.000+ bước chân + 2.5–3L nước)',
      note: 'Duy trì vận động nền NEAT đốt mỡ bụng & uống đủ nước hỗ trợ sức tạ.'
    },
    {
      id: 'habit_sleep',
      order: 6,
      category: 'recovery',
      shortTitle: 'Ngủ đủ 7–8 tiếng',
      shortLabel: 'Ngủ đủ 7–8h',
      title: 'Ngủ đủ 7–8 tiếng (trước 23h30–0h nếu được)',
      note: 'Phục hồi hệ thần kinh, giữ cơ bắp & ổn định sức tạ ở 12 bài ★.'
    }
  ];

  // Canonical v2 — 10 built-in workout groups (6-day LPP + 5-day PPL/UL, 0-Cable default Ways Station)
  const DEFAULT_WORKOUT_GROUPS = [
    {
      "id": "legs_a",
      "name": "T2 - Legs A",
      "shortName": "Legs A",
      "shortDay": "T2",
      "dayOfWeek": 1,
      "dayLabel": "Thứ Hai",
      "planModes": [
        "lpp_6",
        "ppl_ul_5"
      ],
      "focus": "Ưu tiên Chân (<100% InBody) đầu tuần tránh kẹt máy Ngực T2 — Đùi trước, Đùi sau & Bắp chân",
      "priorityNote": "KHÔNG BỎ BUỔI NÀY — T2 máy Chân trống nhất phòng, kéo 2 chân từ 98–99% lên >100%!",
      "isRestDay": false,
      "isBuiltIn": true,
      "priorityLegs": true,
      "color": "#f59e0b",
      "exercises": [
        {
          "id": "ex_legs_a_3",
          "order": 1,
          "stt": 1,
          "isKey": true,
          "keyLiftIndex": 6,
          "excelRow": 11,
          "name": "Seated Leg Curl Machine",
          "machine": "Máy móc đùi sau ngồi (Seated Leg Curl)",
          "alt": "Lying Leg Curl Machine (tập đầu buổi để làm ấm khớp gối)",
          "sets": 3,
          "reps": "10-12",
          "rir": "0-1",
          "rest": "90s-2p"
        },
        {
          "id": "ex_legs_a_1",
          "order": 2,
          "stt": 2,
          "isKey": true,
          "keyLiftIndex": 5,
          "excelRow": 10,
          "name": "Hack Squat Machine",
          "machine": "Máy Squat trượt nghiêng 45° (Hack Squat)",
          "alt": "Smith Machine Squat (chân đặt hơi trước)",
          "sets": 3,
          "reps": "8-10",
          "rir": "1-2",
          "rest": "2.5-3p"
        },
        {
          "id": "ex_legs_a_2",
          "order": 3,
          "stt": 3,
          "isKey": false,
          "keyLiftIndex": null,
          "excelRow": null,
          "name": "45° Leg Press Machine (chân thấp-giữa)",
          "machine": "Máy đạp đùi 45° (Leg Press Machine)",
          "alt": "Horizontal Leg Press Machine",
          "sets": 3,
          "reps": "10-12",
          "rir": "1-2",
          "rest": "2.5p"
        },
        {
          "id": "ex_legs_a_4",
          "order": 4,
          "stt": 4,
          "isKey": false,
          "keyLiftIndex": null,
          "excelRow": null,
          "name": "Leg Extension Machine",
          "machine": "Máy đá đùi trước ngồi (Leg Extension Machine)",
          "alt": "Smith Machine Split Squat",
          "sets": 3,
          "reps": "12-15",
          "rir": "0-1",
          "rest": "90s"
        },
        {
          "id": "ex_legs_a_5",
          "order": 5,
          "stt": 5,
          "isKey": false,
          "keyLiftIndex": null,
          "excelRow": null,
          "name": "Hip Adductor Machine",
          "machine": "Máy khép đùi trong (Seated Hip Adduction)",
          "alt": "Sumo Squat với tạ đơn",
          "sets": 3,
          "reps": "12-15",
          "rir": "0-1",
          "rest": "60-90s"
        },
        {
          "id": "ex_legs_a_6",
          "order": 6,
          "stt": 6,
          "isKey": false,
          "keyLiftIndex": null,
          "excelRow": null,
          "name": "Standing Calf Raise / Calf Press trên Leg Press",
          "machine": "Máy nhón bắp chân đứng hoặc nhón ngay trên máy Leg Press",
          "alt": "Seated Calf Raise Machine",
          "sets": 4,
          "reps": "10-15",
          "rir": "0-1",
          "rest": "60-90s"
        }
      ],
      "suggestions": [
        {
          "name": "Smith Machine Squat",
          "machine": "Máy khung Smith",
          "alt": "Thay Hack Squat khi máy bận",
          "sets": 3,
          "reps": "8-10",
          "rest": "2.5-3p",
          "tag": "Thay thế"
        },
        {
          "name": "Cable Hip Adduction",
          "machine": "Máy kéo cáp thấp + đai cổ chân",
          "alt": "Hip Adductor Machine",
          "sets": 3,
          "reps": "12-15",
          "rest": "60s",
          "tag": "Cáp"
        }
      ]
    },
    {
      "id": "push_a",
      "name": "T3 - Push A",
      "shortName": "Push A",
      "shortDay": "T3",
      "dayOfWeek": 2,
      "dayLabel": "Thứ Ba",
      "planModes": [
        "lpp_6",
        "ppl_ul_5"
      ],
      "focus": "Ngực trên/giữa + Vai ngang + Tay sau (0 Cáp mặc định · Chuẩn máy Ways Station)",
      "priorityNote": "",
      "isRestDay": false,
      "isBuiltIn": true,
      "priorityLegs": false,
      "color": "#10b981",
      "exercises": [
        {
          "id": "ex_push_a_1",
          "order": 1,
          "stt": 1,
          "isKey": true,
          "keyLiftIndex": 1,
          "excelRow": 6,
          "name": "Incline Chest Press Machine (Lắp bánh tạ)",
          "machine": "Máy Chest Press lắp bánh tạ đẩy chéo lên (Plate-Loaded)",
          "alt": "Smith Machine Incline Press 30° / Incline DB Press",
          "sets": 3,
          "reps": "8-10",
          "rir": "1-2",
          "rest": "2.5-3p"
        },
        {
          "id": "ex_push_a_2",
          "order": 2,
          "stt": 2,
          "isKey": false,
          "keyLiftIndex": null,
          "excelRow": null,
          "name": "Flat Chest Press Machine (Tạ khối 8001)",
          "machine": "Máy đẩy ngực ngang cắm chốt (Ways Station 8001)",
          "alt": "Dumbbell Bench Press / Smith Flat Press",
          "sets": 3,
          "reps": "8-12",
          "rir": "1-2",
          "rest": "2-2.5p"
        },
        {
          "id": "ex_push_a_3",
          "order": 3,
          "stt": 3,
          "isKey": false,
          "keyLiftIndex": null,
          "excelRow": null,
          "name": "Pec Deck Fly Machine",
          "machine": "Máy ép ngực bướm (Pec Deck / Butterfly)",
          "alt": "Seated Cable Chest Fly (nếu thích tập cáp)",
          "sets": 3,
          "reps": "12-15",
          "rir": "0-1",
          "rest": "90s"
        },
        {
          "id": "ex_push_a_4",
          "order": 4,
          "stt": 4,
          "isKey": true,
          "keyLiftIndex": 2,
          "excelRow": 7,
          "name": "Machine Lateral Raise",
          "machine": "Máy dang vai ngang ngồi (Lateral Raise Machine)",
          "alt": "Dumbbell Lateral Raise (tạ đơn) hoặc Cable Lateral Raise",
          "sets": 4,
          "reps": "12-15",
          "rir": "0-1",
          "rest": "60-90s"
        },
        {
          "id": "ex_push_a_5",
          "order": 5,
          "stt": 5,
          "isKey": false,
          "keyLiftIndex": null,
          "excelRow": null,
          "name": "Triceps Extension Machine",
          "machine": "Máy duỗi tay sau ngồi cắm chốt (Triceps Extension)",
          "alt": "Dumbbell Overhead Triceps Extension / Overhead Cable Rope",
          "sets": 3,
          "reps": "10-14",
          "rir": "0-1",
          "rest": "90s"
        },
        {
          "id": "ex_push_a_6",
          "order": 6,
          "stt": 6,
          "isKey": false,
          "keyLiftIndex": null,
          "excelRow": null,
          "name": "Seated / Assisted Dip Machine (thân thẳng)",
          "machine": "Máy Dip trợ lực hoặc Máy nhấn tay sau ngồi",
          "alt": "Cable Triceps Pushdown (V-Bar)",
          "sets": 2,
          "reps": "10-12",
          "rir": "0-1",
          "rest": "90s"
        }
      ],
      "suggestions": [
        {
          "name": "Overhead Cable Triceps Extension",
          "machine": "Máy kéo cáp đa năng + dây thừng (Cable Tower Rope)",
          "alt": "Triceps Extension Machine",
          "sets": 3,
          "reps": "10-14",
          "rest": "90s",
          "tag": "Cáp"
        },
        {
          "name": "Cable Triceps Pushdown (V-Bar)",
          "machine": "Máy kéo cáp cao + thanh chữ V",
          "alt": "Seated / Assisted Dip Machine",
          "sets": 2,
          "reps": "10-12",
          "rest": "90s",
          "tag": "Cáp"
        },
        {
          "name": "Seated Cable Chest Fly",
          "machine": "Máy kéo cáp đôi đa năng (Dual Cable)",
          "alt": "Pec Deck Fly Machine",
          "sets": 3,
          "reps": "12-15",
          "rest": "90s",
          "tag": "Cáp"
        }
      ]
    },
    {
      "id": "pull_a",
      "name": "T4 - Pull A",
      "shortName": "Pull A",
      "shortDay": "T4",
      "dayOfWeek": 3,
      "dayLabel": "Thứ Tư",
      "planModes": [
        "lpp_6",
        "ppl_ul_5"
      ],
      "focus": "Xô rộng + Lưng trên + Vai sau + Tay trước + Bụng A (0 Cáp mặc định · Máy cắm chốt)",
      "priorityNote": "",
      "isRestDay": false,
      "isBuiltIn": true,
      "priorityLegs": false,
      "color": "#06b6d4",
      "exercises": [
        {
          "id": "ex_pull_a_1",
          "order": 1,
          "stt": 1,
          "isKey": true,
          "keyLiftIndex": 3,
          "excelRow": 8,
          "name": "Lat Pulldown Machine (4-Stack / Thanh ngang)",
          "machine": "Máy kéo xô trên (4-Stack Multi Station / Lat Pulldown)",
          "alt": "Lat Pulldown tay đòn cố định / Assisted Pull-Up",
          "sets": 3,
          "reps": "8-12",
          "rir": "1-2",
          "rest": "2-2.5p"
        },
        {
          "id": "ex_pull_a_2",
          "order": 2,
          "stt": 2,
          "isKey": false,
          "keyLiftIndex": null,
          "excelRow": null,
          "name": "Seated Row Machine (Đệm ngực — Tay ngang mở khuỷu 45°)",
          "machine": "Máy kéo lưng đệm ngực Ways Station (cầm ngang lưng trên)",
          "alt": "Chest-Supported T-Bar Row",
          "sets": 3,
          "reps": "8-12",
          "rir": "1-2",
          "rest": "2-2.5p"
        },
        {
          "id": "ex_pull_a_3",
          "order": 3,
          "stt": 3,
          "isKey": false,
          "keyLiftIndex": null,
          "excelRow": null,
          "name": "Lat Pulldown Machine (Tay đòn cố định ép xô)",
          "machine": "Máy Lat Pulldown tay đòn cố định (Ways Station)",
          "alt": "Straight-Arm Cable Lat Pullover (nếu tập cáp)",
          "sets": 3,
          "reps": "10-12",
          "rir": "0-1",
          "rest": "90s"
        },
        {
          "id": "ex_pull_a_4",
          "order": 4,
          "stt": 4,
          "isKey": false,
          "keyLiftIndex": null,
          "excelRow": null,
          "name": "Reverse Pec Deck Machine",
          "machine": "Máy ép vai sau (máy Pec Deck gạt tay cầm ra sau)",
          "alt": "Cable Face Pull (nếu tập cáp)",
          "sets": 3,
          "reps": "12-15",
          "rir": "0-1",
          "rest": "60-90s"
        },
        {
          "id": "ex_pull_a_5",
          "order": 5,
          "stt": 5,
          "isKey": false,
          "keyLiftIndex": null,
          "excelRow": null,
          "name": "Iso-Lateral Seated Biceps Curl (8031)",
          "machine": "Máy cuốn tay trước ngồi độc lập (Ways Station 8031)",
          "alt": "Preacher Curl Machine / EZ-Bar Curl",
          "sets": 3,
          "reps": "10-12",
          "rir": "0-1",
          "rest": "90s"
        },
        {
          "id": "ex_pull_a_6",
          "order": 6,
          "stt": 6,
          "isKey": false,
          "keyLiftIndex": null,
          "excelRow": null,
          "name": "Incline Dumbbell Curl (ghế 45°)",
          "machine": "Ghế dốc 45° + Tạ đơn (giãn đầu dài tay trước)",
          "alt": "Behind-the-Back Cable Curl (nếu tập cáp)",
          "sets": 2,
          "reps": "12-15",
          "rir": "0-1",
          "rest": "60-90s"
        },
        {
          "id": "ex_pull_a_7",
          "order": 7,
          "stt": 7,
          "isKey": true,
          "keyLiftIndex": 4,
          "excelRow": 9,
          "name": "[Bụng A] Seated Ab Crunch Machine",
          "machine": "Máy gập bụng ngồi có tạ cắm chốt (Ab Crunch Machine)",
          "alt": "Weighted Cable Crunch (nếu tập cáp)",
          "sets": 3,
          "reps": "12-15",
          "rir": "0-1",
          "rest": "60-90s"
        }
      ],
      "suggestions": [
        {
          "name": "Straight-Arm Cable Lat Pullover",
          "machine": "Máy kéo cáp cao thẳng tay (Cable Tower)",
          "alt": "Lat Pulldown tay đòn cố định",
          "sets": 3,
          "reps": "12-15",
          "rest": "90s",
          "tag": "Cáp"
        },
        {
          "name": "Behind-the-Back Cable Curl",
          "machine": "Máy kéo cáp đơn ròng rọc thấp",
          "alt": "Incline Dumbbell Curl",
          "sets": 2,
          "reps": "12-15",
          "rest": "60-90s",
          "tag": "Cáp"
        },
        {
          "name": "[Bụng A] Weighted Cable Crunch",
          "machine": "Máy kéo cáp cao + dây thừng (Quỳ gập bụng có tạ)",
          "alt": "Seated Ab Crunch Machine",
          "sets": 3,
          "reps": "12-15",
          "rest": "60-90s",
          "tag": "Cáp"
        }
      ]
    },
    {
      "id": "legs_b",
      "name": "T5 - Legs B",
      "shortName": "Legs B",
      "shortDay": "T5",
      "dayOfWeek": 4,
      "dayLabel": "Thứ Năm",
      "planModes": [
        "lpp_6"
      ],
      "focus": "Ưu tiên Chân (cách Legs A 72h) — Đùi sau, Đùi trước, Mông (Leg Press chân CAO), Bắp chân & Bụng C cuối buổi",
      "priorityNote": "KHÔNG BỎ BUỔI NÀY — Bụng C luôn để cuối buổi sau Hack Squat & Leg Press!",
      "isRestDay": false,
      "isBuiltIn": true,
      "priorityLegs": true,
      "color": "#f59e0b",
      "exercises": [
        {
          "id": "ex_legs_b_3",
          "order": 1,
          "stt": 1,
          "isKey": false,
          "keyLiftIndex": null,
          "excelRow": null,
          "name": "Lying Leg Curl Machine",
          "machine": "Máy móc đùi sau nằm sấp (làm ấm khớp gối đầu buổi)",
          "alt": "Seated Leg Curl Machine",
          "sets": 4,
          "reps": "10-12",
          "rir": "0-1",
          "rest": "90s"
        },
        {
          "id": "ex_legs_b_2",
          "order": 2,
          "stt": 2,
          "isKey": false,
          "keyLiftIndex": null,
          "excelRow": null,
          "name": "Hack Squat Machine",
          "machine": "Máy Squat trượt nghiêng 45° (xuống sâu ăn Đùi & Mông)",
          "alt": "Smith Machine RDL / Glute Drive Machine",
          "sets": 3,
          "reps": "8-10",
          "rir": "1-2",
          "rest": "2.5-3p"
        },
        {
          "id": "ex_legs_b_1",
          "order": 3,
          "stt": 3,
          "isKey": true,
          "keyLiftIndex": 11,
          "excelRow": 16,
          "name": "Leg Press Machine (Đặt chân CAO ăn Mông/Đùi sau)",
          "machine": "Máy đạp đùi 45° (đặt bàn chân sát mép trên bàn đạp)",
          "alt": "Smith Machine RDL / Hip Thrust Machine",
          "sets": 3,
          "reps": "10-12",
          "rir": "1-2",
          "rest": "2.5p"
        },
        {
          "id": "ex_legs_b_6",
          "order": 4,
          "stt": 4,
          "isKey": false,
          "keyLiftIndex": null,
          "excelRow": null,
          "name": "Calf Press trên Leg Press / Seated Calf Raise",
          "machine": "Nhón mũi chân ngay trên máy Leg Press (hoặc máy bắp chân ngồi)",
          "alt": "Standing Calf Raise Machine",
          "sets": 4,
          "reps": "12-15",
          "rir": "0-1",
          "rest": "60s"
        },
        {
          "id": "ex_legs_b_4",
          "order": 5,
          "stt": 5,
          "isKey": false,
          "keyLiftIndex": null,
          "excelRow": null,
          "name": "Leg Extension Machine",
          "machine": "Máy đá đùi trước ngồi (cô lập sau 2 bài nặng)",
          "alt": "Smith Machine Bulgarian Split Squat",
          "sets": 3,
          "reps": "12-15",
          "rir": "0-1",
          "rest": "90s"
        },
        {
          "id": "ex_legs_b_5",
          "order": 6,
          "stt": 6,
          "isKey": false,
          "keyLiftIndex": null,
          "excelRow": null,
          "name": "Hip Abductor Machine",
          "machine": "Máy mở đùi ngoài (Seated Hip Abduction)",
          "alt": "Cable Glute Kickback",
          "sets": 2,
          "reps": "12-15",
          "rir": "0-1",
          "rest": "60-90s"
        },
        {
          "id": "ex_legs_b_7",
          "order": 7,
          "stt": 7,
          "isKey": true,
          "keyLiftIndex": 12,
          "excelRow": 17,
          "name": "[Bụng C] Seated Ab Crunch Machine",
          "machine": "Máy gập bụng ngồi có tạ (luôn tập cuối buổi!)",
          "alt": "Weighted Cable Crunch",
          "sets": 3,
          "reps": "12-15",
          "rir": "0-1",
          "rest": "60-90s"
        }
      ],
      "suggestions": [
        {
          "name": "Smith Machine Romanian Deadlift (RDL)",
          "machine": "Máy khung Smith kéo đùi sau (Smith RDL)",
          "alt": "Dumbbell RDL / 45° Back Extension ôm tạ",
          "sets": 3,
          "reps": "8-10",
          "rest": "2.5-3p",
          "tag": "Nâng cao"
        },
        {
          "name": "Hip Thrust / Glute Drive Machine",
          "machine": "Máy đẩy hông mông (Glute Drive / Hip Thrust)",
          "alt": "Leg Press đặt chân cao",
          "sets": 3,
          "reps": "10-12",
          "rest": "2-2.5p",
          "tag": "Mông"
        },
        {
          "name": "Cable Glute Kickback",
          "machine": "Máy kéo cáp thấp + đai cổ chân",
          "alt": "Hip Abductor Machine",
          "sets": 2,
          "reps": "12-15",
          "rest": "60s",
          "tag": "Cáp"
        }
      ]
    },
    {
      "id": "push_b",
      "name": "T6 - Push B",
      "shortName": "Push B",
      "shortDay": "T6",
      "dayOfWeek": 5,
      "dayLabel": "Thứ Sáu",
      "planModes": [
        "lpp_6"
      ],
      "focus": "Ưu tiên Vai + Ngực trên Smith + Ép ngực + Vai ngang + Tay sau + Bụng B cuối buổi (0 Cáp)",
      "priorityNote": "",
      "isRestDay": false,
      "isBuiltIn": true,
      "priorityLegs": false,
      "color": "#10b981",
      "exercises": [
        {
          "id": "ex_push_b_1",
          "order": 1,
          "stt": 1,
          "isKey": true,
          "keyLiftIndex": 7,
          "excelRow": 12,
          "name": "Seated Shoulder Press Machine",
          "machine": "Máy đẩy vai ngồi (Converging Shoulder Press)",
          "alt": "Seated Dumbbell Shoulder Press / Smith OHP",
          "sets": 3,
          "reps": "8-10",
          "rir": "1-2",
          "rest": "2.5p"
        },
        {
          "id": "ex_push_b_2",
          "order": 2,
          "stt": 2,
          "isKey": true,
          "keyLiftIndex": 8,
          "excelRow": 13,
          "name": "Smith Machine Incline Press (30°)",
          "machine": "Máy khung Smith + ghế chỉnh 30° (Incline Press)",
          "alt": "Plate-Loaded Incline Chest Press Machine",
          "sets": 3,
          "reps": "8-12",
          "rir": "1-2",
          "rest": "2.5p"
        },
        {
          "id": "ex_push_b_3",
          "order": 3,
          "stt": 3,
          "isKey": false,
          "keyLiftIndex": null,
          "excelRow": null,
          "name": "Flat Chest Press Machine (Tạ khối 8001)",
          "machine": "Máy đẩy ngực ngang cắm chốt Ways Station 8001",
          "alt": "Có thể bỏ qua nếu muốn rút ngắn buổi còn 60 phút",
          "sets": 2,
          "reps": "8-12",
          "rir": "1-2",
          "rest": "2p"
        },
        {
          "id": "ex_push_b_5",
          "order": 4,
          "stt": 4,
          "isKey": false,
          "keyLiftIndex": null,
          "excelRow": null,
          "name": "Pec Deck Fly Machine",
          "machine": "Máy ép ngực bướm (Pec Deck / Butterfly)",
          "alt": "Seated Cable Chest Fly (nếu tập cáp)",
          "sets": 3,
          "reps": "10-12",
          "rir": "0-1",
          "rest": "90s"
        },
        {
          "id": "ex_push_b_4",
          "order": 5,
          "stt": 5,
          "isKey": false,
          "keyLiftIndex": null,
          "excelRow": null,
          "name": "Machine Lateral Raise / Dumbbell Lateral Raise",
          "machine": "Máy dang vai ngang ngồi hoặc Tạ đơn dang vai",
          "alt": "Single-Arm Cable Lateral Raise (nếu tập cáp)",
          "sets": 4,
          "reps": "12-15",
          "rir": "0-1",
          "rest": "60-90s"
        },
        {
          "id": "ex_push_b_6",
          "order": 6,
          "stt": 6,
          "isKey": false,
          "keyLiftIndex": null,
          "excelRow": null,
          "name": "Triceps Extension Machine / Assisted Dip",
          "machine": "Máy duỗi tay sau ngồi hoặc Máy Dip trợ lực (thân thẳng)",
          "alt": "Cable Triceps Pushdown (nếu tập cáp)",
          "sets": 3,
          "reps": "10-12",
          "rir": "0-1",
          "rest": "90s"
        },
        {
          "id": "ex_push_b_7",
          "order": 7,
          "stt": 7,
          "isKey": false,
          "keyLiftIndex": null,
          "excelRow": null,
          "name": "[Bụng B] Captain's Chair / Hanging Leg Raise",
          "machine": "Khung tập bụng xà kép tựa lưng (luôn để cuối buổi!)",
          "alt": "Xà đơn treo người cuộn xương chậu",
          "sets": 3,
          "reps": "10-15",
          "rir": "0-1",
          "rest": "60-90s"
        }
      ],
      "suggestions": [
        {
          "name": "Single-Arm Cable Lateral Raise",
          "machine": "Máy kéo cáp đơn ngang cổ tay (Cable Tower)",
          "alt": "Machine / Dumbbell Lateral Raise",
          "sets": 4,
          "reps": "12-15",
          "rest": "60-90s",
          "tag": "Cáp"
        },
        {
          "name": "Cable Triceps Pushdown (Straight Bar)",
          "machine": "Máy kéo cáp cao + thanh thẳng",
          "alt": "Triceps Extension Machine",
          "sets": 3,
          "reps": "10-12",
          "rest": "90s",
          "tag": "Cáp"
        },
        {
          "name": "Seated Cable Chest Fly (Low-to-High)",
          "machine": "Máy kéo cáp đôi đa năng",
          "alt": "Pec Deck Fly Machine",
          "sets": 3,
          "reps": "12-15",
          "rest": "90s",
          "tag": "Cáp"
        }
      ]
    },
    {
      "id": "pull_b",
      "name": "T7 - Pull B",
      "shortName": "Pull B",
      "shortDay": "T7",
      "dayOfWeek": 6,
      "dayLabel": "Thứ Bảy",
      "planModes": [
        "lpp_6"
      ],
      "focus": "Lưng dày + Xô máy cố định + Vai sau + Tay trước & Cẳng tay + Liên sườn (0 Cáp · Chuẩn Ways Station)",
      "priorityNote": "",
      "isRestDay": false,
      "isBuiltIn": true,
      "priorityLegs": false,
      "color": "#06b6d4",
      "exercises": [
        {
          "id": "ex_pull_b_1",
          "order": 1,
          "stt": 1,
          "isKey": true,
          "keyLiftIndex": 9,
          "excelRow": 14,
          "name": "Seated Row Machine (Đệm ngực — Tay dọc ép hông)",
          "machine": "Máy kéo lưng đệm ngực Ways Station (cầm tay dọc ăn Xô)",
          "alt": "Seated Cable Row (nếu tập cáp)",
          "sets": 3,
          "reps": "8-12",
          "rir": "1-2",
          "rest": "2-2.5p"
        },
        {
          "id": "ex_pull_b_2",
          "order": 2,
          "stt": 2,
          "isKey": true,
          "keyLiftIndex": 10,
          "excelRow": 15,
          "name": "Lat Pulldown Machine (Tay đòn cố định)",
          "machine": "Máy Lat Pulldown tay đòn cố định Ways Station",
          "alt": "Assisted Pull-Up Machine / 4-Stack Pulldown",
          "sets": 3,
          "reps": "8-10",
          "rir": "1-2",
          "rest": "2-2.5p"
        },
        {
          "id": "ex_pull_b_3",
          "order": 3,
          "stt": 3,
          "isKey": false,
          "keyLiftIndex": null,
          "excelRow": null,
          "name": "Chest-Supported High Row / Seated Row tay ngang",
          "machine": "Máy kéo lưng trên đệm ngực (hoặc Seated Row cầm tay ngang mở khuỷu 45°)",
          "alt": "T-Bar Row có đệm ngực",
          "sets": 3,
          "reps": "10-12",
          "rir": "1-2",
          "rest": "2p"
        },
        {
          "id": "ex_pull_b_4",
          "order": 4,
          "stt": 4,
          "isKey": false,
          "keyLiftIndex": null,
          "excelRow": null,
          "name": "Reverse Pec Deck Machine",
          "machine": "Máy ép vai sau (máy Pec Deck gạt tay ra sau)",
          "alt": "Cable Face Pull (nếu tập cáp)",
          "sets": 3,
          "reps": "12-15",
          "rir": "0-1",
          "rest": "60-90s"
        },
        {
          "id": "ex_pull_b_6",
          "order": 5,
          "stt": 5,
          "isKey": false,
          "keyLiftIndex": null,
          "excelRow": null,
          "name": "Iso-Lateral Seated Biceps Curl (8031)",
          "machine": "Máy cuốn tay trước ngồi độc lập (Ways Station 8031)",
          "alt": "Preacher Curl / Dumbbell Curl",
          "sets": 3,
          "reps": "10-12",
          "rir": "0-1",
          "rest": "60-90s"
        },
        {
          "id": "ex_pull_b_5",
          "order": 6,
          "stt": 6,
          "isKey": false,
          "keyLiftIndex": null,
          "excelRow": null,
          "name": "Dumbbell Hammer Curl",
          "machine": "Tạ đơn đứng cuốn dọc kiểu cầm búa (Cẳng tay & Bắp tay ngoài)",
          "alt": "Cable Hammer Curl dây thừng (nếu tập cáp)",
          "sets": 3,
          "reps": "10-12",
          "rir": "0-1",
          "rest": "60-90s"
        },
        {
          "id": "ex_pull_b_7",
          "order": 7,
          "stt": 7,
          "isKey": false,
          "keyLiftIndex": null,
          "excelRow": null,
          "name": "[Liên sườn] Torso Rotation Machine",
          "machine": "Máy xoay eo Ways Station (nhẹ vừa 25–30 kg, 1 buổi/tuần)",
          "alt": "Cable Woodchopper / Pallof Press",
          "sets": 2,
          "reps": "12-15/bên",
          "rir": "1",
          "rest": "60s"
        }
      ],
      "suggestions": [
        {
          "name": "Cable Face Pull (Rope)",
          "machine": "Máy kéo cáp ngang trán + dây thừng",
          "alt": "Reverse Pec Deck Machine",
          "sets": 3,
          "reps": "15-20",
          "rest": "60-90s",
          "tag": "Cáp"
        },
        {
          "name": "Cable Hammer Curl (Rope)",
          "machine": "Máy kéo cáp thấp + dây thừng",
          "alt": "Dumbbell Hammer Curl",
          "sets": 3,
          "reps": "10-12",
          "rest": "60-90s",
          "tag": "Cáp"
        },
        {
          "name": "Cable Woodchopper",
          "machine": "Máy kéo cáp chéo thân",
          "alt": "Torso Rotation Machine",
          "sets": 2,
          "reps": "12-15/bên",
          "rest": "60s",
          "tag": "Cáp"
        }
      ]
    },
    {
      "id": "rest_midweek",
      "name": "T5 - Nghỉ Giữa Tuần (PPL/UL 5b)",
      "shortName": "Nghỉ T5",
      "shortDay": "T5",
      "dayOfWeek": 4,
      "dayLabel": "Thứ Năm",
      "planModes": [
        "ppl_ul_5"
      ],
      "focus": "Nghỉ tạ giữa tuần cho chế độ 5 buổi PPL/UL · Đi bộ 8.000+ bước · Phục hồi khớp trước 2 buổi Lower & Upper",
      "priorityNote": "Chế độ 5 buổi/tuần: nghỉ T5 giúp T6 Lower & T7 Upper đẩy tạ sung sức hơn!",
      "isRestDay": true,
      "isBuiltIn": true,
      "priorityLegs": false,
      "color": "#64748b",
      "exercises": [
        {
          "id": "ex_rest_mid_1",
          "order": 1,
          "stt": 1,
          "isKey": false,
          "keyLiftIndex": null,
          "excelRow": null,
          "name": "Đi bộ nhẹ 8.000+ bước (NEAT đốt mỡ bụng)",
          "machine": "Ngoài trời / Máy chạy bộ đi bộ phẳng",
          "alt": "Đạp xe nhẹ 25 phút",
          "sets": 0,
          "reps": "30-40p",
          "rir": "",
          "rest": "-"
        },
        {
          "id": "ex_rest_mid_2",
          "order": 2,
          "stt": 2,
          "isKey": false,
          "keyLiftIndex": null,
          "excelRow": null,
          "name": "Giãn cơ vai, lưng & đùi 10 phút · Giữ đủ 4 phần đạm",
          "machine": "Thảm tập / Ăn gọn không calo lỏng",
          "alt": "Ngủ sớm trước 23h30",
          "sets": 0,
          "reps": "10p",
          "rir": "",
          "rest": "-"
        }
      ],
      "suggestions": []
    },
    {
      "id": "ul_lower",
      "name": "T6 - Lower (PPL/UL 5b)",
      "shortName": "Lower 5b",
      "shortDay": "T6",
      "dayOfWeek": 5,
      "dayLabel": "Thứ Sáu",
      "planModes": [
        "ppl_ul_5"
      ],
      "focus": "Chế độ 5 buổi PPL/UL — Chân toàn diện (Đùi sau, Đùi trước, Mông, Bắp chân) & Bụng cuối buổi (0 Cáp)",
      "priorityNote": "Ưu tiên kéo 2 chân từ 98–99% lên >100% · Bụng luôn để cuối buổi!",
      "isRestDay": false,
      "isBuiltIn": true,
      "priorityLegs": true,
      "color": "#f59e0b",
      "exercises": [
        {
          "id": "ex_ul_lower_1",
          "order": 1,
          "stt": 1,
          "isKey": false,
          "keyLiftIndex": null,
          "excelRow": null,
          "name": "Lying Leg Curl Machine",
          "machine": "Máy móc đùi sau nằm sấp (làm ấm gối đầu buổi)",
          "alt": "Seated Leg Curl Machine",
          "sets": 4,
          "reps": "10-12",
          "rir": "0-1",
          "rest": "90s"
        },
        {
          "id": "ex_ul_lower_2",
          "order": 2,
          "stt": 2,
          "isKey": true,
          "keyLiftIndex": 5,
          "excelRow": 10,
          "name": "Hack Squat Machine",
          "machine": "Máy Squat trượt nghiêng 45° (Đùi trước + Mông)",
          "alt": "Smith Machine Squat",
          "sets": 3,
          "reps": "8-10",
          "rir": "1-2",
          "rest": "2.5-3p"
        },
        {
          "id": "ex_ul_lower_3",
          "order": 3,
          "stt": 3,
          "isKey": true,
          "keyLiftIndex": 11,
          "excelRow": 16,
          "name": "Leg Press Machine (Đặt chân CAO ăn Mông/Đùi sau)",
          "machine": "Máy đạp đùi 45° (đặt chân sát mép trên bàn đạp)",
          "alt": "Smith Machine RDL / Hip Thrust Machine",
          "sets": 3,
          "reps": "10-12",
          "rir": "1-2",
          "rest": "2.5p"
        },
        {
          "id": "ex_ul_lower_4",
          "order": 4,
          "stt": 4,
          "isKey": false,
          "keyLiftIndex": null,
          "excelRow": null,
          "name": "Calf Press trên Leg Press / Seated Calf Raise",
          "machine": "Nhón mũi chân ngay trên Leg Press hoặc máy Bắp chân ngồi",
          "alt": "Standing Calf Raise Machine",
          "sets": 4,
          "reps": "12-15",
          "rir": "0-1",
          "rest": "60s"
        },
        {
          "id": "ex_ul_lower_5",
          "order": 5,
          "stt": 5,
          "isKey": false,
          "keyLiftIndex": null,
          "excelRow": null,
          "name": "Leg Extension Machine",
          "machine": "Máy đá đùi trước ngồi",
          "alt": "Smith Machine Split Squat",
          "sets": 3,
          "reps": "12-15",
          "rir": "0-1",
          "rest": "90s"
        },
        {
          "id": "ex_ul_lower_6",
          "order": 6,
          "stt": 6,
          "isKey": false,
          "keyLiftIndex": null,
          "excelRow": null,
          "name": "Hip Abductor Machine",
          "machine": "Máy mở đùi ngoài (Seated Hip Abduction)",
          "alt": "Cable Glute Kickback",
          "sets": 2,
          "reps": "12-15",
          "rir": "0-1",
          "rest": "60-90s"
        },
        {
          "id": "ex_ul_lower_7",
          "order": 7,
          "stt": 7,
          "isKey": true,
          "keyLiftIndex": 12,
          "excelRow": 17,
          "name": "[Bụng] Seated Ab Crunch Machine",
          "machine": "Máy gập bụng ngồi có tạ (cuối buổi)",
          "alt": "Weighted Cable Crunch",
          "sets": 3,
          "reps": "12-15",
          "rir": "0-1",
          "rest": "60-90s"
        }
      ],
      "suggestions": [
        {
          "name": "Smith Machine Romanian Deadlift (RDL)",
          "machine": "Máy khung Smith kéo đùi sau",
          "alt": "45° Back Extension ôm tạ",
          "sets": 3,
          "reps": "8-10",
          "rest": "2.5-3p",
          "tag": "Nâng cao"
        },
        {
          "name": "Hip Thrust / Glute Drive Machine",
          "machine": "Máy đẩy hông mông",
          "alt": "Leg Press chân cao",
          "sets": 3,
          "reps": "10-12",
          "rest": "2-2.5p",
          "tag": "Mông"
        }
      ]
    },
    {
      "id": "ul_upper",
      "name": "T7 - Upper (PPL/UL 5b)",
      "shortName": "Upper 5b",
      "shortDay": "T7",
      "dayOfWeek": 6,
      "dayLabel": "Thứ Bảy",
      "planModes": [
        "ppl_ul_5"
      ],
      "focus": "Chế độ 5 buổi PPL/UL — Thân trên toàn diện: Ngực trên + Lưng dày + Vai + Xô + Tay trước/sau + Bụng (0 Cáp)",
      "priorityNote": "",
      "isRestDay": false,
      "isBuiltIn": true,
      "priorityLegs": false,
      "color": "#8b5cf6",
      "exercises": [
        {
          "id": "ex_ul_upper_1",
          "order": 1,
          "stt": 1,
          "isKey": true,
          "keyLiftIndex": 8,
          "excelRow": 13,
          "name": "Smith Machine Incline Press (30°)",
          "machine": "Máy khung Smith + ghế chỉnh 30° (Ngực trên)",
          "alt": "Incline Chest Press Machine",
          "sets": 3,
          "reps": "8-12",
          "rir": "1-2",
          "rest": "2.5p"
        },
        {
          "id": "ex_ul_upper_2",
          "order": 2,
          "stt": 2,
          "isKey": true,
          "keyLiftIndex": 9,
          "excelRow": 14,
          "name": "Seated Row Machine (Đệm ngực — Tay ngang mở khuỷu 45°)",
          "machine": "Máy kéo lưng đệm ngực Ways Station (Lưng dày & Lưng trên)",
          "alt": "Chest-Supported T-Bar Row",
          "sets": 3,
          "reps": "8-12",
          "rir": "1-2",
          "rest": "2-2.5p"
        },
        {
          "id": "ex_ul_upper_3",
          "order": 3,
          "stt": 3,
          "isKey": true,
          "keyLiftIndex": 7,
          "excelRow": 12,
          "name": "Seated Shoulder Press Machine",
          "machine": "Máy đẩy vai ngồi (Converging Shoulder Press)",
          "alt": "Seated Dumbbell Shoulder Press",
          "sets": 3,
          "reps": "8-10",
          "rir": "1-2",
          "rest": "2p"
        },
        {
          "id": "ex_ul_upper_4",
          "order": 4,
          "stt": 4,
          "isKey": true,
          "keyLiftIndex": 10,
          "excelRow": 15,
          "name": "Lat Pulldown Machine (Tay đòn cố định)",
          "machine": "Máy kéo xô tay đòn cố định Ways Station",
          "alt": "4-Stack Lat Pulldown / Assisted Pull-Up",
          "sets": 3,
          "reps": "8-12",
          "rir": "1-2",
          "rest": "2p"
        },
        {
          "id": "ex_ul_upper_5",
          "order": 5,
          "stt": 5,
          "isKey": false,
          "keyLiftIndex": null,
          "excelRow": null,
          "name": "Machine Lateral Raise / Dumbbell Lateral Raise",
          "machine": "Máy dang vai ngang ngồi hoặc Tạ đơn",
          "alt": "Single-Arm Cable Lateral Raise",
          "sets": 3,
          "reps": "12-15",
          "rir": "0-1",
          "rest": "60s"
        },
        {
          "id": "ex_ul_upper_6",
          "order": 6,
          "stt": 6,
          "isKey": false,
          "keyLiftIndex": null,
          "excelRow": null,
          "name": "Reverse Pec Deck Machine",
          "machine": "Máy ép vai sau (Pec Deck gạt tay ra sau)",
          "alt": "Cable Face Pull",
          "sets": 2,
          "reps": "12-15",
          "rir": "0-1",
          "rest": "60s"
        },
        {
          "id": "ex_ul_upper_7",
          "order": 7,
          "stt": 7,
          "isKey": false,
          "keyLiftIndex": null,
          "excelRow": null,
          "name": "Iso-Lateral Seated Biceps Curl (8031)",
          "machine": "Máy cuốn tay trước ngồi độc lập Ways Station 8031",
          "alt": "Dumbbell Hammer Curl",
          "sets": 2,
          "reps": "10-12",
          "rir": "0-1",
          "rest": "60s"
        },
        {
          "id": "ex_ul_upper_8",
          "order": 8,
          "stt": 8,
          "isKey": false,
          "keyLiftIndex": null,
          "excelRow": null,
          "name": "Triceps Extension Machine / Assisted Dip",
          "machine": "Máy duỗi tay sau ngồi hoặc Dip trợ lực",
          "alt": "Cable Triceps Pushdown",
          "sets": 2,
          "reps": "10-12",
          "rir": "0-1",
          "rest": "60s"
        },
        {
          "id": "ex_ul_upper_9",
          "order": 9,
          "stt": 9,
          "isKey": false,
          "keyLiftIndex": null,
          "excelRow": null,
          "name": "[Bụng] Captain's Chair / Hanging Leg Raise",
          "machine": "Khung xà kép tựa lưng cuộn xương chậu (cuối buổi)",
          "alt": "Torso Rotation Machine (nhẹ 25–30 kg)",
          "sets": 2,
          "reps": "10-15",
          "rir": "0-1",
          "rest": "60s"
        }
      ],
      "suggestions": [
        {
          "name": "Pec Deck Fly Machine",
          "machine": "Máy ép ngực bướm (Pec Deck)",
          "alt": "Seated Cable Chest Fly",
          "sets": 2,
          "reps": "12-15",
          "rest": "60-90s",
          "tag": "Ngực thêm"
        },
        {
          "name": "Dumbbell Hammer Curl",
          "machine": "Tạ đơn đứng cuốn dọc (Cẳng tay)",
          "alt": "Cable Hammer Curl",
          "sets": 2,
          "reps": "10-12",
          "rest": "60s",
          "tag": "Cẳng tay"
        },
        {
          "name": "Cable Face Pull (Rope)",
          "machine": "Máy kéo cáp ngang trán + dây thừng",
          "alt": "Reverse Pec Deck Machine",
          "sets": 2,
          "reps": "15-20",
          "rest": "60s",
          "tag": "Cáp"
        },
        {
          "name": "[Liên sườn] Torso Rotation Machine",
          "machine": "Máy xoay eo Ways Station (nhẹ 25–30 kg)",
          "alt": "Cable Woodchopper",
          "sets": 2,
          "reps": "12-15/bên",
          "rest": "60s",
          "tag": "Liên sườn"
        }
      ]
    },
    {
      "id": "rest_sunday",
      "name": "CN - Nghỉ & Phục Hồi",
      "shortName": "Nghỉ CN",
      "shortDay": "CN",
      "dayOfWeek": 0,
      "dayLabel": "Chủ Nhật",
      "planModes": [
        "lpp_6",
        "ppl_ul_5"
      ],
      "focus": "Nghỉ tập tạ hoàn toàn · Đi bộ 8.000+ bước · Giãn cơ nhẹ 10p · Cắt nửa chén cơm tối · Review tuần 3 phút",
      "priorityNote": "Phục hồi hệ thần kinh & hoàn thành Review sáng Chủ Nhật",
      "isRestDay": true,
      "isBuiltIn": true,
      "priorityLegs": false,
      "color": "#64748b",
      "exercises": [
        {
          "id": "ex_rest_sun_1",
          "order": 1,
          "stt": 1,
          "isKey": false,
          "keyLiftIndex": null,
          "excelRow": null,
          "name": "Đi bộ thư giãn 8.000+ bước",
          "machine": "Ngoài trời / Máy đi bộ nhẹ",
          "alt": "Đạp xe nhẹ thư giãn 30 phút",
          "sets": 0,
          "reps": "30-45p",
          "rir": "",
          "rest": "-"
        },
        {
          "id": "ex_rest_sun_2",
          "order": 2,
          "stt": 2,
          "isKey": false,
          "keyLiftIndex": null,
          "excelRow": null,
          "name": "Giãn cơ nhẹ toàn thân 10 phút",
          "machine": "Thảm tập / Foam Roller",
          "alt": "Giãn khớp vai, hông & gân kheo",
          "sets": 0,
          "reps": "10p",
          "rir": "",
          "rest": "-"
        },
        {
          "id": "ex_rest_sun_3",
          "order": 3,
          "stt": 3,
          "isKey": false,
          "keyLiftIndex": null,
          "excelRow": null,
          "name": "Review sáng Chủ Nhật (3 phút: Cân nặng, Vòng eo & Log tạ ★)",
          "machine": "Tab Review Tuần & Đồng bộ Excel/Sheets",
          "alt": "Cắt bớt nửa chén cơm bữa tối ngày nghỉ",
          "sets": 0,
          "reps": "3p",
          "rir": "",
          "rest": "-"
        }
      ],
      "suggestions": []
    }
  ];

  const DEFAULT_GROUP_BY_ID = new Map(DEFAULT_WORKOUT_GROUPS.map((g) => [g.id, g]));

  // Canonical v2 — 12 ★ key lifts aligned with Sheet 3_Log_Ta_12_Bai_Chinh (rows 6..17)
  const KEY_LIFTS_12 = [
    {
      "keyLiftIndex": 1,
      "excelRow": 6,
      "exerciseId": "ex_push_a_1",
      "altExerciseId": "push_a_1",
      "groupId": "push_a",
      "session": "T3 - Push A",
      "name": "Incline Chest Press Machine (Lắp bánh tạ)",
      "machine": "Máy Chest Press lắp bánh tạ",
      "target": "3 x 8-10"
    },
    {
      "keyLiftIndex": 2,
      "excelRow": 7,
      "exerciseId": "ex_push_a_4",
      "altExerciseId": "push_a_4",
      "groupId": "push_a",
      "session": "T3 - Push A",
      "name": "Machine Lateral Raise",
      "machine": "Máy dang vai ngang ngồi",
      "target": "4 x 12-15"
    },
    {
      "keyLiftIndex": 3,
      "excelRow": 8,
      "exerciseId": "ex_pull_a_1",
      "altExerciseId": "pull_a_1",
      "groupId": "pull_a",
      "session": "T4 - Pull A",
      "name": "Lat Pulldown Machine (4-Stack / Thanh ngang)",
      "machine": "Máy kéo xô trên 4-Stack",
      "target": "3 x 8-12"
    },
    {
      "keyLiftIndex": 4,
      "excelRow": 9,
      "exerciseId": "ex_pull_a_7",
      "altExerciseId": "pull_a_7",
      "groupId": "pull_a",
      "session": "T4 - Pull A",
      "name": "[Bụng A] Seated Ab Crunch Machine",
      "machine": "Máy gập bụng ngồi có tạ",
      "target": "3 x 12-15"
    },
    {
      "keyLiftIndex": 5,
      "excelRow": 10,
      "exerciseId": "ex_legs_a_1",
      "altExerciseId": "legs_a_1",
      "groupId": "legs_a",
      "session": "T2 - Legs A",
      "name": "Hack Squat Machine",
      "machine": "Máy Squat trượt nghiêng 45°",
      "target": "3 x 8-10"
    },
    {
      "keyLiftIndex": 6,
      "excelRow": 11,
      "exerciseId": "ex_legs_a_3",
      "altExerciseId": "legs_a_3",
      "groupId": "legs_a",
      "session": "T2 - Legs A",
      "name": "Seated Leg Curl Machine",
      "machine": "Máy móc đùi sau ngồi",
      "target": "3 x 10-12"
    },
    {
      "keyLiftIndex": 7,
      "excelRow": 12,
      "exerciseId": "ex_push_b_1",
      "altExerciseId": "push_b_1",
      "groupId": "push_b",
      "session": "T6 - Push B",
      "name": "Seated Shoulder Press Machine",
      "machine": "Máy đẩy vai ngồi",
      "target": "3 x 8-10"
    },
    {
      "keyLiftIndex": 8,
      "excelRow": 13,
      "exerciseId": "ex_push_b_2",
      "altExerciseId": "push_b_2",
      "groupId": "push_b",
      "session": "T6 - Push B",
      "name": "Smith Machine Incline Press (30°)",
      "machine": "Máy khung Smith ghế 30°",
      "target": "3 x 8-12"
    },
    {
      "keyLiftIndex": 9,
      "excelRow": 14,
      "exerciseId": "ex_pull_b_1",
      "altExerciseId": "pull_b_1",
      "groupId": "pull_b",
      "session": "T7 - Pull B",
      "name": "Seated Row Machine (Tay dọc ép hông)",
      "machine": "Máy kéo lưng đệm ngực Ways Station",
      "target": "3 x 8-12"
    },
    {
      "keyLiftIndex": 10,
      "excelRow": 15,
      "exerciseId": "ex_pull_b_2",
      "altExerciseId": "pull_b_2",
      "groupId": "pull_b",
      "session": "T7 - Pull B",
      "name": "Lat Pulldown Machine (Tay đòn cố định)",
      "machine": "Máy Lat Pulldown cố định Ways Station",
      "target": "3 x 8-10"
    },
    {
      "keyLiftIndex": 11,
      "excelRow": 16,
      "exerciseId": "ex_legs_b_1",
      "altExerciseId": "legs_b_1",
      "groupId": "legs_b",
      "session": "T5 - Legs B",
      "name": "Leg Press Machine (Đặt chân CAO ăn Mông/Đùi sau)",
      "machine": "Máy đạp đùi 45° (chân cao)",
      "target": "3 x 10-12"
    },
    {
      "keyLiftIndex": 12,
      "excelRow": 17,
      "exerciseId": "ex_legs_b_7",
      "altExerciseId": "legs_b_7",
      "groupId": "legs_b",
      "session": "T5 - Legs B",
      "name": "[Bụng C] Seated Ab Crunch Machine",
      "machine": "Máy gập bụng ngồi có tạ",
      "target": "3 x 12-15"
    }
  ];

  const STRENGTH_TREND_OPTIONS = ['Tăng tốt', 'Giữ ổn', 'Hơi tụt'];

  // ==========================================
  // INTERNAL DATE, NUMBER & ALIAS HELPERS
  // ==========================================
  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function getTodayDateStr() {
    const d = new Date();
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function parseIsoDate(dateStr) {
    if (!dateStr || typeof dateStr !== 'string') return null;
    const parts = dateStr.slice(0, 10).split('-').map(Number);
    if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return null;
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function formatIsoDate(dateObj) {
    return `${dateObj.getFullYear()}-${pad2(dateObj.getMonth() + 1)}-${pad2(dateObj.getDate())}`;
  }

  function addDaysToIso(dateStr, days) {
    const d = parseIsoDate(dateStr) || new Date();
    d.setDate(d.getDate() + Number(days || 0));
    return formatIsoDate(d);
  }

  function diffDaysIso(fromDateStr, toDateStr) {
    const a = parseIsoDate(fromDateStr);
    const b = parseIsoDate(toDateStr);
    if (!a || !b) return 0;
    const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.round((utcB - utcA) / 86400000);
  }

  function formatVnDateShort(dateStr) {
    const d = parseIsoDate(dateStr);
    if (!d) return '--/--';
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
  }

  function formatVnDateFull(dateStr) {
    const d = parseIsoDate(dateStr);
    if (!d) return '--/--/----';
    return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
  }

  function getVnDayLabel(dateStr) {
    const d = parseIsoDate(dateStr);
    if (!d) return '';
    const names = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    return names[d.getDay()];
  }

  function parseNullableNumber(val) {
    if (val === null || val === undefined || val === '' || typeof val === 'boolean') return null;
    const cleaned = typeof val === 'string' ? val.replace(',', '.').trim() : val;
    if (cleaned === '') return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }

  function parsePositiveWeight(val) {
    const n = parseNullableNumber(val);
    return n !== null && n > 0 ? Math.round(n * 100) / 100 : null;
  }

  function round1(n) {
    if (n === null || n === undefined || !Number.isFinite(n)) return null;
    return Math.round(n * 10) / 10;
  }

  function getTaskDateStr(task) {
    const raw = task?.date || task?.dateKey || '';
    return typeof raw === 'string' ? raw.slice(0, 10) : '';
  }

  // Canonicalize exercise IDs seamlessly between 'ex_push_a_1' (frontend) and 'push_a_1' (backend)
  const CANONICAL_EX_PREFIX_RE = /^(push_a|pull_a|legs_a|push_b|pull_b|legs_b|rest_sun|rest_mid|ul_lower|ul_upper)_\d+$/;

  function canonicalizeExerciseId(exId) {
    if (!exId || typeof exId !== 'string') return '';
    const trimmed = exId.trim();
    if (!trimmed) return '';
    if (CANONICAL_EX_PREFIX_RE.test(trimmed)) {
      return 'ex_' + trimmed;
    }
    return trimmed;
  }

  function getExerciseIdAliases(exId) {
    if (!exId || typeof exId !== 'string') return [];
    const trimmed = exId.trim();
    if (!trimmed) return [];
    const list = [trimmed];
    if (trimmed.startsWith('ex_')) {
      list.push(trimmed.slice(3));
    } else if (CANONICAL_EX_PREFIX_RE.test(trimmed)) {
      list.push('ex_' + trimmed);
    }
    return list;
  }

  // Cross-mode key-lift equivalence so weight history & 12 ★ review stay seamless across 6-day LPP & 5-day PPL/UL
  const KEY_LIFT_INDEX_TO_EXERCISE_ID = new Map(
    KEY_LIFTS_12.map((kl) => [kl.keyLiftIndex, kl.exerciseId])
  );
  const KEY_LIFT_EQUIVALENT_GROUPS = (() => {
    const byIdx = new Map();
    const add = (idx, id) => {
      if (!idx || !id) return;
      if (!byIdx.has(idx)) byIdx.set(idx, new Set());
      byIdx.get(idx).add(canonicalizeExerciseId(id));
    };
    KEY_LIFTS_12.forEach((kl) => add(kl.keyLiftIndex, kl.exerciseId));
    DEFAULT_WORKOUT_GROUPS.forEach((g) => {
      (g.exercises || []).forEach((ex) => {
        if (ex.keyLiftIndex) add(ex.keyLiftIndex, ex.id);
      });
    });
    const map = new Map();
    byIdx.forEach((idSet) => {
      const allAliases = new Set();
      idSet.forEach((cid) => getExerciseIdAliases(cid).forEach((a) => allAliases.add(a)));
      const arr = Array.from(allAliases);
      arr.forEach((a) => map.set(a, arr));
    });
    return map;
  })();

  function getWeightLookupAliases(exId) {
    const base = getExerciseIdAliases(exId);
    const canon = canonicalizeExerciseId(exId);
    const equiv = KEY_LIFT_EQUIVALENT_GROUPS.get(canon) || KEY_LIFT_EQUIVALENT_GROUPS.get(exId);
    if (!equiv) return base;
    return Array.from(new Set([...base, ...equiv]));
  }

  function normalizeExerciseSetChecks(task) {
    const setsFromField = Number(task && task.gymSets);
    const setsFromRepsMatch = String((task && task.gymSetsReps) || '').match(/^(\d+)/);
    const setsFromReps = setsFromRepsMatch ? Number(setsFromRepsMatch[1]) : 0;
    const totalSets = Math.max(
      1,
      Math.round(
        (Number.isFinite(setsFromField) && setsFromField > 0 ? setsFromField : 0) ||
        (Number.isFinite(setsFromReps) && setsFromReps > 0 ? setsFromReps : 0) ||
        3
      )
    );

    if (Array.isArray(task && task.gymSetChecks) && task.gymSetChecks.length > 0) {
      const normalized = [];
      for (let i = 0; i < totalSets; i += 1) {
        normalized.push(Boolean(task.gymSetChecks[i]));
      }
      return normalized;
    }

    if (task && task.completed) {
      return Array(totalSets).fill(true);
    }

    return Array(totalSets).fill(false);
  }

  function canonicalizeHabitId(hid) {
    if (!hid) return null;
    if (hid === 'habit_no_liquid') return 'habit_no_liquid_cal';
    return hid;
  }

  function cloneExercise(ex, fallbackOrder) {
    const ord = Number(ex?.order || ex?.stt) || fallbackOrder || 1;
    return {
      id: String(ex?.id || `ex_custom_${ord}`),
      order: ord,
      stt: ord,
      isKey: Boolean(ex?.isKey),
      keyLiftIndex: ex?.keyLiftIndex ? Number(ex.keyLiftIndex) : null,
      excelRow: ex?.excelRow ? Number(ex.excelRow) : null,
      name: String(ex?.name || '').trim(),
      machine: String(ex?.machine || '').trim(),
      alt: String(ex?.alt || ex?.altMachine || '').trim(),
      sets: Number.isFinite(Number(ex?.sets)) ? Math.max(0, Number(ex.sets)) : 3,
      reps: String(ex?.reps || '10-12').trim(),
      rir: String(ex?.rir || '').trim(),
      rest: String(ex?.rest || '90s').trim()
    };
  }

  function cloneSuggestion(sug) {
    if (!sug || typeof sug !== 'object') return null;
    const name = String(sug.name || '').trim();
    if (!name) return null;
    return {
      name,
      machine: String(sug.machine || '').trim(),
      alt: String(sug.alt || sug.altMachine || '').trim(),
      sets: Number.isFinite(Number(sug.sets)) ? Math.max(0, Number(sug.sets)) : 3,
      reps: String(sug.reps || '10-12').trim(),
      rest: String(sug.rest || '90s').trim(),
      tag: String(sug.tag || '').trim()
    };
  }

  function cloneWorkoutGroup(group, fallbackIndex) {
    const id = String(group?.id || `custom_group_${(fallbackIndex || 0) + 1}`);
    const defaultMatch = DEFAULT_GROUP_BY_ID.get(id) || null;
    const exercises = Array.isArray(group?.exercises)
      ? group.exercises.map((ex, idx) => cloneExercise(ex, idx + 1)).filter((ex) => ex.name)
      : [];
    const planModes = Array.isArray(group?.planModes) && group.planModes.length > 0
      ? Array.from(new Set(group.planModes.map(String).filter((m) => Boolean(PLAN_MODES[m]))))
      : (defaultMatch && Array.isArray(defaultMatch.planModes)
          ? defaultMatch.planModes.slice()
          : Object.keys(PLAN_MODES));
    const rawSuggestions = Array.isArray(group?.suggestions)
      ? group.suggestions
      : (defaultMatch && Array.isArray(defaultMatch.suggestions) ? defaultMatch.suggestions : []);
    const suggestions = rawSuggestions.map(cloneSuggestion).filter(Boolean);

    return {
      id,
      name: String(group?.name || 'Nhóm tập mới').trim(),
      shortName: String(group?.shortName || group?.shortDay || group?.name || 'Nhóm tập').trim(),
      shortDay: String(group?.shortDay || '').trim(),
      dayOfWeek:
        group?.dayOfWeek === null || group?.dayOfWeek === undefined || group?.dayOfWeek === ''
          ? null
          : Number(group.dayOfWeek),
      dayLabel: String(group?.dayLabel || '').trim(),
      planModes: planModes.length > 0 ? planModes : Object.keys(PLAN_MODES),
      focus: String(group?.focus || group?.subtitle || '').trim(),
      priorityNote: String(group?.priorityNote || '').trim(),
      isRestDay: Boolean(group?.isRestDay || group?.isRest),
      isBuiltIn: Boolean(group?.isBuiltIn || group?.isDefault),
      priorityLegs: Boolean(group?.priorityLegs),
      color: String(group?.color || '#10b981'),
      updatedAt: Number(group?.updatedAt) || 0,
      exercises,
      suggestions
    };
  }

  // ==========================================
  // DEFAULT STATE & SAFE NORMALIZATION
  // ==========================================
  function getDefaultGymData() {
    return {
      version: 2,
      activePlanMode: DEFAULT_PLAN_MODE,
      planStartSunday: PLAN_START_SUNDAY,
      baseline: { ...DEFAULT_BASELINE },
      dailyHabitsTemplate: DAILY_HABITS_TEMPLATE.map((h) => ({ ...h })),
      workoutGroups: DEFAULT_WORKOUT_GROUPS.map((g, idx) => cloneWorkoutGroup(g, idx)),
      deletedGroupIds: [],
      dailyLogs: {},
      weeklyCheckins: {},
      inbodyChecks: [],
      updatedAt: 0
    };
  }

  function normalizeGymData(raw) {
    const defaults = getDefaultGymData();
    if (!raw || typeof raw !== 'object') {
      return defaults;
    }

    const rawVersion = Number(raw.version) || 1;
    const activePlanMode = (typeof raw.activePlanMode === 'string' && PLAN_MODES[raw.activePlanMode])
      ? raw.activePlanMode
      : DEFAULT_PLAN_MODE;

    const deletedGroupIds = Array.isArray(raw.deletedGroupIds)
      ? Array.from(new Set(raw.deletedGroupIds.map(String).filter(Boolean)))
      : [];
    const deletedSet = new Set(deletedGroupIds);

    // Baseline
    const rawBaseline = raw.baseline && typeof raw.baseline === 'object' ? raw.baseline : {};
    const pbfVal = parseNullableNumber(rawBaseline.pbfPct ?? rawBaseline.pbf) ?? DEFAULT_BASELINE.pbfPct;
    const baseline = {
      ...DEFAULT_BASELINE,
      ...rawBaseline,
      weightKg: parseNullableNumber(rawBaseline.weightKg) ?? DEFAULT_BASELINE.weightKg,
      smmKg: parseNullableNumber(rawBaseline.smmKg) ?? DEFAULT_BASELINE.smmKg,
      fatKg: parseNullableNumber(rawBaseline.fatKg) ?? DEFAULT_BASELINE.fatKg,
      pbf: pbfVal,
      pbfPct: pbfVal,
      trunkFatKg: parseNullableNumber(rawBaseline.trunkFatKg) ?? DEFAULT_BASELINE.trunkFatKg,
      waistCm: parseNullableNumber(rawBaseline.waistCm),
      updatedAt: Number(rawBaseline.updatedAt) || 0
    };

    // Workout groups (auto-upgrade unmodified v1 built-ins cleanly while preserving user edits & custom groups)
    let workoutGroups = defaults.workoutGroups;
    if (Array.isArray(raw.workoutGroups) && raw.workoutGroups.length > 0) {
      const seenIds = new Set();
      const cleaned = [];
      let anyEditedBuiltIn = false;
      raw.workoutGroups.forEach((g, idx) => {
        if (!g || typeof g !== 'object') return;
        const gid = String(g.id || '');
        const isUntouchedV1BuiltIn =
          rawVersion < 2 &&
          Boolean(g.isBuiltIn || g.isDefault) &&
          !(Number(g.updatedAt) > 0) &&
          !Array.isArray(g.planModes) &&
          DEFAULT_GROUP_BY_ID.has(gid);
        if (Boolean(g.isBuiltIn || g.isDefault) && Number(g.updatedAt) > 0) {
          anyEditedBuiltIn = true;
        }
        const sourceGroup = isUntouchedV1BuiltIn ? DEFAULT_GROUP_BY_ID.get(gid) : g;
        const cloned = cloneWorkoutGroup(sourceGroup, idx);
        if (!cloned.id || seenIds.has(cloned.id)) return;
        seenIds.add(cloned.id);
        cleaned.push(cloned);
      });
      // Ensure built-in groups aren't accidentally dropped unless explicitly deleted
      DEFAULT_WORKOUT_GROUPS.forEach((defG, idx) => {
        if (!seenIds.has(defG.id) && !deletedSet.has(defG.id)) {
          cleaned.push(cloneWorkoutGroup(defG, idx));
        }
      });
      if (cleaned.length > 0) {
        if (rawVersion < 2 && !anyEditedBuiltIn) {
          // Order upgraded v1 built-in groups in canonical v2 LPP/PPL-UL order, keeping custom groups at the end
          const orderRank = new Map(DEFAULT_WORKOUT_GROUPS.map((dg, i) => [dg.id, i]));
          cleaned.sort((a, b) => {
            const ra = orderRank.has(a.id) ? orderRank.get(a.id) : 999;
            const rb = orderRank.has(b.id) ? orderRank.get(b.id) : 999;
            return ra - rb;
          });
        }
        workoutGroups = cleaned;
      }
    }

    // Daily habits template
    let dailyHabitsTemplate = defaults.dailyHabitsTemplate;
    if (Array.isArray(raw.dailyHabitsTemplate) && raw.dailyHabitsTemplate.length === 6) {
      dailyHabitsTemplate = raw.dailyHabitsTemplate.map((h, idx) => {
        const merged = {
          ...DAILY_HABITS_TEMPLATE[idx],
          ...(h && typeof h === 'object' ? h : {})
        };
        merged.id = canonicalizeHabitId(merged.id) || DAILY_HABITS_TEMPLATE[idx].id;
        return merged;
      });
    }

    // Daily logs (bridge both frontend and backend field names)
    const dailyLogs = {};
    if (raw.dailyLogs && typeof raw.dailyLogs === 'object') {
      Object.entries(raw.dailyLogs).forEach(([dateKey, entry]) => {
        if (!dateKey || !entry || typeof entry !== 'object') return;
        const normalizedKey = String(dateKey).slice(0, 10);
        if (!parseIsoDate(normalizedKey)) return;

        const habits = {};
        if (entry.habits && typeof entry.habits === 'object') {
          Object.entries(entry.habits).forEach(([hid, val]) => {
            const canonId = canonicalizeHabitId(hid);
            if (canonId) habits[canonId] = Boolean(val);
          });
        }

        const weights = {};
        if (entry.weights && typeof entry.weights === 'object') {
          Object.entries(entry.weights).forEach(([exId, val]) => {
            const w = parsePositiveWeight(val);
            if (w !== null) weights[exId] = w;
          });
        }

        const completedExercises = {};
        const rawDone = entry.completedExercises || entry.exerciseDone || {};
        if (rawDone && typeof rawDone === 'object') {
          Object.entries(rawDone).forEach(([exId, val]) => {
            completedExercises[exId] = Boolean(val);
          });
        }

        const setProgress = {};
        if (entry.setProgress && typeof entry.setProgress === 'object') {
          Object.entries(entry.setProgress).forEach(([exId, arr]) => {
            const canonExId = canonicalizeExerciseId(exId);
            if (!canonExId || !Array.isArray(arr) || arr.length === 0) return;
            setProgress[canonExId] = arr.map((v) => Boolean(v));
          });
        }

        const groupId = entry.workoutGroupId || entry.groupId || null;
        const groupName = String(entry.workoutGroupName || entry.groupName || '');

        dailyLogs[normalizedKey] = {
          ...entry,
          date: normalizedKey,
          workoutGroupId: groupId,
          groupId,
          workoutGroupName: groupName,
          groupName,
          habits,
          weights,
          completedExercises,
          exerciseDone: { ...completedExercises },
          setProgress,
          clearedWorkout: Boolean(entry.clearedWorkout),
          note: String(entry.note || ''),
          updatedAt: Number(entry.updatedAt) || 0
        };
      });
    }

    // Weekly checkins (keys '1'..'12', tolerating 'T1'..'T12' and raw.weeklyReviews)
    const weeklyCheckins = {};
    const rawCheckins = (raw.weeklyCheckins && typeof raw.weeklyCheckins === 'object')
      ? raw.weeklyCheckins
      : (raw.weeklyReviews && typeof raw.weeklyReviews === 'object' ? raw.weeklyReviews : {});

    Object.entries(rawCheckins).forEach(([rawKey, entry]) => {
      if (!entry || typeof entry !== 'object') return;
      const numMatch = String(rawKey).match(/(\d+)/);
      const weekNum = numMatch ? Number(numMatch[1]) : Number(entry.weekNum || entry.week);
      if (!Number.isFinite(weekNum) || weekNum < 1 || weekNum > 24) return;
      const wkKey = String(weekNum);

      const keyLiftWeights = {};
      const rawKL = entry.keyLiftWeights || entry.keyLifts || {};
      if (rawKL && typeof rawKL === 'object') {
        Object.entries(rawKL).forEach(([exId, val]) => {
          const w = parsePositiveWeight(val);
          if (w !== null) keyLiftWeights[exId] = w;
        });
      }

      const feel = String(entry.strengthTrend || entry.strengthFeel || entry.liftFeel || '').trim();
      weeklyCheckins[wkKey] = {
        ...entry,
        weekNum,
        weightKg: parseNullableNumber(entry.weightKg),
        waistCm: parseNullableNumber(entry.waistCm),
        strengthTrend: feel,
        strengthFeel: feel,
        note: String(entry.note || ''),
        sessionsOverride: parseNullableNumber(entry.sessionsOverride ?? entry.workoutSessions),
        cleanEatingOverride: parseNullableNumber(entry.cleanEatingOverride ?? entry.cleanEatingDays),
        stepsSleepOverride: parseNullableNumber(entry.stepsSleepOverride ?? entry.stepsSleepDays),
        keyLiftWeights,
        updatedAt: Number(entry.updatedAt) || 0
      };
    });

    const planStartSunday =
      typeof raw.planStartSunday === 'string' && parseIsoDate(raw.planStartSunday)
        ? raw.planStartSunday.slice(0, 10)
        : PLAN_START_SUNDAY;

    return {
      version: Math.max(2, rawVersion),
      activePlanMode,
      planStartSunday,
      baseline,
      dailyHabitsTemplate,
      workoutGroups,
      deletedGroupIds,
      dailyLogs,
      weeklyCheckins,
      inbodyChecks: Array.isArray(raw.inbodyChecks) ? raw.inbodyChecks : [],
      updatedAt: Number(raw.updatedAt) || 0
    };
  }

  /**
   * Non-destructive 2-way merge between local and remote gym_data.json
   * Preserves every offline weight log, habit tick, weekly check-in, and custom group!
   */
  function mergeGymData(localRaw, remoteRaw) {
    const local = normalizeGymData(localRaw);
    if (!remoteRaw || typeof remoteRaw !== 'object') return local;
    const remote = normalizeGymData(remoteRaw);

    const localTopTs = Number(local.updatedAt) || 0;
    const remoteTopTs = Number(remote.updatedAt) || 0;

    // 1. Baseline (prefer newer timestamp, preserve non-null waistCm)
    const localBaseTs = Number(local.baseline?.updatedAt) || localTopTs;
    const remoteBaseTs = Number(remote.baseline?.updatedAt) || remoteTopTs;
    const mergedBaseline = remoteBaseTs > localBaseTs
      ? { ...local.baseline, ...remote.baseline, waistCm: remote.baseline.waistCm ?? local.baseline.waistCm }
      : { ...remote.baseline, ...local.baseline, waistCm: local.baseline.waistCm ?? remote.baseline.waistCm };

    // 2. Deleted groups union
    const deletedSet = new Set([...(local.deletedGroupIds || []), ...(remote.deletedGroupIds || [])]);

    // 3. Workout groups merge (union + Last-Write-Wins per group)
    const groupMap = new Map();
    local.workoutGroups.forEach((g) => {
      if (!deletedSet.has(g.id)) groupMap.set(g.id, g);
    });
    remote.workoutGroups.forEach((rg) => {
      if (deletedSet.has(rg.id)) return;
      if (!groupMap.has(rg.id)) {
        groupMap.set(rg.id, rg);
      } else {
        const lg = groupMap.get(rg.id);
        const lTs = Number(lg.updatedAt) || localTopTs;
        const rTs = Number(rg.updatedAt) || remoteTopTs;
        if (rTs > lTs) {
          groupMap.set(rg.id, rg);
        }
      }
    });

    // 4. Daily logs merge (per-date LWW + union of weights)
    const mergedDailyLogs = {};
    const allDates = new Set([...Object.keys(local.dailyLogs), ...Object.keys(remote.dailyLogs)]);
    allDates.forEach((d) => {
      const lLog = local.dailyLogs[d];
      const rLog = remote.dailyLogs[d];
      if (!lLog) {
        mergedDailyLogs[d] = rLog;
      } else if (!rLog) {
        mergedDailyLogs[d] = lLog;
      } else {
        const lTs = Number(lLog.updatedAt) || localTopTs;
        const rTs = Number(rLog.updatedAt) || remoteTopTs;
        const winner = rTs > lTs ? rLog : lLog;
        const loser = rTs > lTs ? lLog : rLog;
        const mergedSetProgress = {};
        const loserSP = loser.setProgress && typeof loser.setProgress === 'object' ? loser.setProgress : {};
        const winnerSP = winner.setProgress && typeof winner.setProgress === 'object' ? winner.setProgress : {};
        Object.entries(loserSP).forEach(([exId, arr]) => {
          const canonExId = canonicalizeExerciseId(exId);
          if (canonExId && Array.isArray(arr) && arr.length > 0) {
            mergedSetProgress[canonExId] = arr.map(Boolean);
          }
        });
        Object.entries(winnerSP).forEach(([exId, arr]) => {
          const canonExId = canonicalizeExerciseId(exId);
          if (canonExId && Array.isArray(arr) && arr.length > 0) {
            mergedSetProgress[canonExId] = arr.map(Boolean);
          }
        });
        const mergedClearedWorkout = Boolean(winner.clearedWorkout);
        mergedDailyLogs[d] = {
          ...loser,
          ...winner,
          habits: { ...(loser.habits || {}), ...(winner.habits || {}) },
          weights: { ...(loser.weights || {}), ...(winner.weights || {}) },
          completedExercises: { ...(loser.completedExercises || {}), ...(winner.completedExercises || {}) },
          exerciseDone: { ...(loser.completedExercises || {}), ...(winner.completedExercises || {}) },
          setProgress: mergedClearedWorkout ? {} : mergedSetProgress,
          clearedWorkout: mergedClearedWorkout,
          updatedAt: Math.max(lTs, rTs)
        };
      }
    });

    // 5. Weekly checkins merge (per-week LWW + union of keyLiftWeights)
    const mergedWeekly = {};
    const allWeeks = new Set([...Object.keys(local.weeklyCheckins), ...Object.keys(remote.weeklyCheckins)]);
    allWeeks.forEach((wk) => {
      const lWk = local.weeklyCheckins[wk];
      const rWk = remote.weeklyCheckins[wk];
      if (!lWk) {
        mergedWeekly[wk] = rWk;
      } else if (!rWk) {
        mergedWeekly[wk] = lWk;
      } else {
        const lTs = Number(lWk.updatedAt) || localTopTs;
        const rTs = Number(rWk.updatedAt) || remoteTopTs;
        const winner = rTs > lTs ? rWk : lWk;
        const loser = rTs > lTs ? lWk : rWk;
        mergedWeekly[wk] = {
          ...loser,
          ...winner,
          weightKg: winner.weightKg ?? loser.weightKg,
          waistCm: winner.waistCm ?? loser.waistCm,
          strengthTrend: winner.strengthTrend || loser.strengthTrend || '',
          strengthFeel: winner.strengthTrend || loser.strengthTrend || '',
          note: winner.note || loser.note || '',
          keyLiftWeights: { ...(loser.keyLiftWeights || {}), ...(winner.keyLiftWeights || {}) },
          updatedAt: Math.max(lTs, rTs)
        };
      }
    });

    let mergedActivePlanMode = local.activePlanMode || DEFAULT_PLAN_MODE;
    if (remoteTopTs > localTopTs) {
      mergedActivePlanMode = PLAN_MODES[remote.activePlanMode] ? remote.activePlanMode : mergedActivePlanMode;
    } else if (
      remoteTopTs === localTopTs &&
      remoteTopTs === 0 &&
      mergedActivePlanMode === DEFAULT_PLAN_MODE &&
      remote.activePlanMode &&
      PLAN_MODES[remote.activePlanMode] &&
      remote.activePlanMode !== DEFAULT_PLAN_MODE
    ) {
      mergedActivePlanMode = remote.activePlanMode;
    }

    return normalizeGymData({
      version: Math.max(2, local.version, remote.version),
      activePlanMode: mergedActivePlanMode,
      planStartSunday: remoteTopTs > localTopTs ? remote.planStartSunday : local.planStartSunday,
      baseline: mergedBaseline,
      dailyHabitsTemplate: local.dailyHabitsTemplate,
      workoutGroups: Array.from(groupMap.values()),
      deletedGroupIds: Array.from(deletedSet),
      dailyLogs: mergedDailyLogs,
      weeklyCheckins: mergedWeekly,
      inbodyChecks: remoteTopTs > localTopTs && remote.inbodyChecks.length > 0 ? remote.inbodyChecks : local.inbodyChecks,
      updatedAt: Math.max(localTopTs, remoteTopTs)
    });
  }

  // ==========================================
  // SCHEDULE & WEEK DATE MAPPING
  // ==========================================
  const DAY_OF_WEEK_GROUP_MAP = PLAN_MODES[DEFAULT_PLAN_MODE].dayMap;

  function getSuggestedGroupForDate(dateStr, workoutGroups, activePlanMode = DEFAULT_PLAN_MODE) {
    const groups = Array.isArray(workoutGroups) && workoutGroups.length > 0
      ? workoutGroups
      : DEFAULT_WORKOUT_GROUPS;
    const modeKey = (typeof activePlanMode === 'string' && PLAN_MODES[activePlanMode])
      ? activePlanMode
      : DEFAULT_PLAN_MODE;
    const dayMap = PLAN_MODES[modeKey].dayMap || DAY_OF_WEEK_GROUP_MAP;
    const d = parseIsoDate(dateStr) || new Date();
    const dow = d.getDay();
    const preferredId = dayMap[dow] ?? dayMap[String(dow)];

    return (
      groups.find((g) => g.id === preferredId) ||
      groups.find((g) => g.dayOfWeek === dow && (!Array.isArray(g.planModes) || g.planModes.includes(modeKey))) ||
      groups.find((g) => g.dayOfWeek === dow) ||
      DEFAULT_WORKOUT_GROUPS.find((g) => g.id === preferredId) ||
      groups[0]
    );
  }

  function getWeekDates(weekNum, planStartSunday) {
    const wk = Math.max(1, Math.floor(Number(weekNum) || 1));
    const startSun = parseIsoDate(planStartSunday) ? planStartSunday.slice(0, 10) : PLAN_START_SUNDAY;
    const sundayDate = addDaysToIso(startSun, (wk - 1) * 7);
    const mondayDate = addDaysToIso(sundayDate, -6);
    const dates = [];
    for (let i = 0; i < 7; i += 1) {
      dates.push(addDaysToIso(mondayDate, i));
    }
    return dates;
  }

  function getWeekNumberForDate(dateStr, planStartSunday) {
    const startSun = parseIsoDate(planStartSunday) ? planStartSunday.slice(0, 10) : PLAN_START_SUNDAY;
    const target = parseIsoDate(dateStr) ? dateStr.slice(0, 10) : getTodayDateStr();
    const week1Monday = addDaysToIso(startSun, -6);
    const diff = diffDaysIso(week1Monday, target);
    const rawWeek = Math.floor(diff / 7) + 1;
    return Math.min(12, Math.max(1, rawWeek));
  }

  // ==========================================
  // EXERCISE WEIGHT HISTORY LOOKUP
  // ==========================================
  function getLatestExerciseWeightEntry(gymData, tasks, exerciseId, beforeDateStr) {
    if (!exerciseId) return null;
    const normalized = normalizeGymData(gymData);
    const cutoff = beforeDateStr ? String(beforeDateStr).slice(0, 10) : '';
    const aliases = new Set(getWeightLookupAliases(exerciseId));

    let best = null;

    const consider = (weightVal, dateStr, updatedAt) => {
      const w = parsePositiveWeight(weightVal);
      if (w === null) return;
      const d = dateStr ? String(dateStr).slice(0, 10) : '';
      if (cutoff && d && d >= cutoff) return;
      const ts = Number(updatedAt) || 0;

      if (!best) {
        best = { weightKg: w, date: d, updatedAt: ts };
        return;
      }
      if (d > best.date || (d === best.date && ts >= best.updatedAt)) {
        best = { weightKg: w, date: d, updatedAt: ts };
      }
    };

    // 1. Scan checklist tasks
    if (Array.isArray(tasks)) {
      tasks.forEach((t) => {
        if (!t || !aliases.has(t.gymExerciseId)) return;
        consider(t.gymWeightKg, getTaskDateStr(t), Number(t.updatedAt || t.createdAt) || 0);
      });
    }

    // 2. Scan dailyLogs
    Object.entries(normalized.dailyLogs).forEach(([dateKey, log]) => {
      if (!log?.weights) return;
      aliases.forEach((aid) => {
        const w = log.weights[aid];
        if (w !== undefined && w !== null) {
          consider(w, dateKey, Number(log.updatedAt) || 0);
        }
      });
    });

    // 3. Scan weeklyCheckins.keyLiftWeights
    Object.entries(normalized.weeklyCheckins).forEach(([wkKey, checkin]) => {
      if (!checkin?.keyLiftWeights) return;
      aliases.forEach((aid) => {
        const w = checkin.keyLiftWeights[aid];
        if (w !== undefined && w !== null) {
          const weekDates = getWeekDates(Number(wkKey), normalized.planStartSunday);
          consider(w, weekDates[0], Number(checkin.updatedAt) || 0);
        }
      });
    });

    return best;
  }

  function getLatestExerciseWeight(gymData, tasks, exerciseId, beforeDateStr) {
    const entry = getLatestExerciseWeightEntry(gymData, tasks || [], exerciseId, beforeDateStr || '');
    return entry ? entry.weightKg : null;
  }

  // ==========================================
  // DAILY HABIT & WORKOUT SUMMARY (XANH/VÀNG/ĐỎ)
  // ==========================================
  const HABIT_TITLE_TO_ID = new Map(
    DAILY_HABITS_TEMPLATE.map((h) => [h.title.trim().toLowerCase(), h.id])
  );

  function resolveHabitIdFromTask(task) {
    if (!task) return null;
    if (task.gymHabitId) return canonicalizeHabitId(task.gymHabitId);
    if (typeof task.title === 'string') {
      const exact = HABIT_TITLE_TO_ID.get(task.title.trim().toLowerCase());
      if (exact) return exact;
    }
    return null;
  }

  function getDayHabitSummary(dateStr, gymData, tasks) {
    const targetDate = dateStr ? String(dateStr).slice(0, 10) : '';
    const normalized = normalizeGymData(gymData);
    const dailyLog = targetDate ? normalized.dailyLogs[targetDate] || null : null;
    const dayTasks = Array.isArray(tasks)
      ? tasks.filter((t) => t && getTaskDateStr(t) === targetDate)
      : [];

    const habitTaskById = {};
    let hasHabitTasks = false;
    const exerciseTasks = [];

    dayTasks.forEach((t) => {
      const habitId = resolveHabitIdFromTask(t);
      if (habitId) {
        hasHabitTasks = true;
        if (!habitTaskById[habitId] || t.completed) {
          habitTaskById[habitId] = t;
        }
        return;
      }
      if (t.gymType === 'exercise') {
        exerciseTasks.push(t);
      }
    });

    const habitsMap = {};
    let doneCount = 0;
    normalized.dailyHabitsTemplate.forEach((habit) => {
      const taskMatch = habitTaskById[habit.id];
      const isDone = taskMatch
        ? Boolean(taskMatch.completed)
        : Boolean(dailyLog?.habits?.[habit.id]);
      habitsMap[habit.id] = isDone;
      if (isDone) doneCount += 1;
    });

    const exerciseStats = new Map();
    exerciseTasks.forEach((t, idx) => {
      const checks = normalizeExerciseSetChecks(t);
      const doneSets = checks.filter(Boolean).length;
      const targetSets = checks.length;
      const isDone = Boolean(t.completed) || (targetSets > 0 && doneSets === targetSets);
      const key = canonicalizeExerciseId(t.gymExerciseId) || String(t.id || `ex_task_${idx}`);
      exerciseStats.set(key, {
        setsDone: doneSets,
        setsTarget: targetSets,
        completed: isDone
      });
    });

    if (dailyLog && dailyLog.setProgress && typeof dailyLog.setProgress === 'object') {
      Object.entries(dailyLog.setProgress).forEach(([rawExId, arr]) => {
        const key = canonicalizeExerciseId(rawExId);
        if (!key || exerciseStats.has(key) || !Array.isArray(arr) || arr.length === 0) return;
        const doneSets = arr.filter(Boolean).length;
        const targetSets = arr.length;
        exerciseStats.set(key, {
          setsDone: doneSets,
          setsTarget: targetSets,
          completed: doneSets === targetSets
        });
      });
    }

    let setsDone = 0;
    let setsTarget = 0;
    let exerciseDoneCount = 0;
    exerciseStats.forEach((st) => {
      setsDone += st.setsDone;
      setsTarget += st.setsTarget;
      if (st.completed) exerciseDoneCount += 1;
    });
    const exerciseTotalCount = exerciseStats.size;

    const firstExercise = exerciseTasks[0] || null;
    const workoutGroupId = firstExercise?.gymGroupId || dailyLog?.workoutGroupId || dailyLog?.groupId || null;
    const matchedGroup = workoutGroupId
      ? normalized.workoutGroups.find((g) => g.id === workoutGroupId) || null
      : null;
    const workoutGroupName =
      firstExercise?.gymGroupName || dailyLog?.workoutGroupName || dailyLog?.groupName || matchedGroup?.name || '';
    const isRestGroup = Boolean(
      matchedGroup?.isRestDay ||
      workoutGroupId === 'rest_sunday' ||
      workoutGroupId === 'rest_midweek'
    );

    const dObj = parseIsoDate(targetDate);
    const isSunday = dObj ? dObj.getDay() === 0 : false;

    const completedWorkoutExercises =
      !isRestGroup &&
      (
        (exerciseTotalCount > 0 &&
          (exerciseDoneCount >= Math.max(1, Math.ceil(exerciseTotalCount * 0.5)) ||
            exerciseDoneCount >= 3)) ||
        (setsTarget > 0 && setsDone >= Math.max(1, Math.ceil(setsTarget * 0.5)))
      );

    const workoutDone = (isSunday || isRestGroup)
      ? completedWorkoutExercises
      : Boolean(completedWorkoutExercises || habitsMap.habit_workout);

    const cleanEating = Boolean(
      habitsMap.habit_protein && habitsMap.habit_carbs && habitsMap.habit_no_liquid_cal
    );
    const stepsSleep = Boolean(habitsMap.habit_steps_water && habitsMap.habit_sleep);

    const hasSetProgress = Boolean(
      dailyLog &&
        dailyLog.setProgress &&
        Object.values(dailyLog.setProgress).some((arr) => Array.isArray(arr) && arr.length > 0)
    );

    const hasLogActivity = Boolean(
      dailyLog &&
        (Object.values(dailyLog.habits || {}).some(Boolean) ||
          Object.keys(dailyLog.weights || {}).length > 0 ||
          hasSetProgress ||
          (dailyLog.workoutGroupId && !dailyLog.clearedWorkout) ||
          dailyLog.note)
    );

    let status = 'none';
    let label = 'Chưa chấm';
    if (doneCount >= 5) {
      status = 'green';
      label = 'XANH';
    } else if (doneCount >= 3) {
      status = 'yellow';
      label = 'VÀNG';
    } else if (doneCount >= 1) {
      status = 'red';
      label = 'ĐỎ';
    } else if (hasHabitTasks || (hasLogActivity && !exerciseTotalCount && targetDate && targetDate < getTodayDateStr())) {
      status = 'red';
      label = 'ĐỎ';
    }

    return {
      doneCount,
      totalCount: 6,
      status,
      label,
      cleanEating,
      stepsSleep,
      workoutDone,
      habitsMap,
      exerciseDoneCount,
      exerciseTotalCount,
      setsDone,
      setsTarget,
      workoutGroupId,
      workoutGroupName,
      hasHabitTasks,
      hasActivity: Boolean(hasHabitTasks || exerciseTotalCount > 0 || setsTarget > 0 || hasLogActivity)
    };
  }

  // ==========================================
  // WEEKLY ADVICE FORMULA (MATCHES EXCEL SHEET 1)
  // ==========================================
  function computeWeeklyAdvice({ weekNum, hasActivity, sessionsCount, cleanEatingDays, waistDelta, strengthTrend, targetSessionsPerWeek = 6 }) {
    if (!hasActivity) {
      return {
        text: 'Chưa có dữ liệu tuần này — Tick đủ hiệp từng bài tập mỗi buổi & check-in 30 giây sáng Chủ Nhật.',
        tone: 'neutral'
      };
    }
    if (weekNum === 9) {
      return {
        text: 'Tuần Deload: giảm 40% hiệp, phục hồi khớp',
        tone: 'cyan'
      };
    }
    if (strengthTrend === 'Hơi tụt') {
      return {
        text: 'Đang thiếu năng lượng/ngủ: thêm 1/2 chén cơm quanh giờ tập & ngủ >=7.5h',
        tone: 'rose'
      };
    }
    const targetSessions = Number(targetSessionsPerWeek) === 5 ? 5 : 6;
    const minRecommendedSessions = targetSessions === 5 ? 4 : 5;
    if (
      (sessionsCount !== null && sessionsCount < 4) ||
      (cleanEatingDays !== null && cleanEatingDays < 5)
    ) {
      return {
        text: `Ưu tiên giữ đều >=${minRecommendedSessions} buổi/tuần & 5/7 ngày ăn chuẩn trước`,
        tone: 'amber'
      };
    }
    if (waistDelta !== null && waistDelta <= -0.5) {
      return {
        text: 'Rất tốt! Eo đang giảm & tạ ổn -> Giữ nguyên chế độ',
        tone: 'emerald'
      };
    }
    return {
      text: 'Ổn định! Nếu 2 tuần liên tiếp eo đứng im -> giảm nửa chén cơm bữa tối',
      tone: 'emerald'
    };
  }

  // ==========================================
  // WEEKLY ANALYTICS ENGINE (T1..T12 + 12 ★ + DAILY HISTORY)
  // ==========================================
  function computeWeeklyAnalytics(gymData, tasks) {
    const normalized = normalizeGymData(gymData);
    const { baseline, planStartSunday, weeklyCheckins, dailyLogs, workoutGroups, activePlanMode } = normalized;
    const planModeKey = PLAN_MODES[activePlanMode] ? activePlanMode : DEFAULT_PLAN_MODE;
    const targetSessionsPerWeek = PLAN_MODES[planModeKey].sessionsPerWeek || 6;
    const safeTasks = Array.isArray(tasks) ? tasks : [];

    const exerciseMetaMap = new Map();
    workoutGroups.forEach((g) => {
      g.exercises.forEach((ex) => {
        const meta = { ...ex, groupId: g.id, groupName: g.name };
        getExerciseIdAliases(ex.id).forEach((aid) => exerciseMetaMap.set(aid, meta));
      });
    });
    KEY_LIFTS_12.forEach((kl) => {
      const meta = {
        id: kl.exerciseId,
        name: kl.name,
        machine: kl.machine,
        isKey: true,
        keyLiftIndex: kl.keyLiftIndex,
        groupId: kl.groupId,
        groupName: kl.session
      };
      getExerciseIdAliases(kl.exerciseId).forEach((aid) => {
        if (!exerciseMetaMap.has(aid)) exerciseMetaMap.set(aid, meta);
      });
    });

    const tasksByDate = new Map();
    safeTasks.forEach((t) => {
      const d = getTaskDateStr(t);
      if (!d) return;
      if (!tasksByDate.has(d)) tasksByDate.set(d, []);
      tasksByDate.get(d).push(t);
    });

    const weeks = [];
    for (let weekNum = 1; weekNum <= 12; weekNum += 1) {
      const dates = getWeekDates(weekNum, planStartSunday);
      const mondayDate = dates[0];
      const sundayDate = dates[6];
      const checkin = weeklyCheckins[String(weekNum)] || {};

      let autoSessionsCount = 0;
      let autoCleanEatingDays = 0;
      let autoStepsSleepDays = 0;
      let greenDays = 0;
      let yellowDays = 0;
      let redDays = 0;
      let weekHasDailyActivity = false;

      const weekAutoWeights = {};
      const recordAutoWeight = (exId, val) => {
        const w = parsePositiveWeight(val);
        if (w === null || !exId) return;
        const targetAliases = new Set(getWeightLookupAliases(exId));
        const meta = exerciseMetaMap.get(exId) || exerciseMetaMap.get(canonicalizeExerciseId(exId));
        if (meta && meta.keyLiftIndex) {
          const canonicalKeyId = KEY_LIFT_INDEX_TO_EXERCISE_ID.get(Number(meta.keyLiftIndex));
          if (canonicalKeyId) {
            getExerciseIdAliases(canonicalKeyId).forEach((aid) => targetAliases.add(aid));
          }
        }
        targetAliases.forEach((aid) => {
          if (weekAutoWeights[aid] === undefined || w > weekAutoWeights[aid]) {
            weekAutoWeights[aid] = w;
          }
        });
      };

      dates.forEach((dStr) => {
        const dayTasks = tasksByDate.get(dStr) || [];
        const summary = getDayHabitSummary(dStr, normalized, dayTasks);

        if (summary.hasActivity) weekHasDailyActivity = true;
        if (summary.workoutDone) autoSessionsCount += 1;
        if (summary.cleanEating) autoCleanEatingDays += 1;
        if (summary.stepsSleep) autoStepsSleepDays += 1;
        if (summary.status === 'green') greenDays += 1;
        else if (summary.status === 'yellow') yellowDays += 1;
        else if (summary.status === 'red') redDays += 1;

        dayTasks.forEach((t) => {
          if (t.gymExerciseId && t.gymWeightKg !== null && t.gymWeightKg !== undefined) {
            recordAutoWeight(t.gymExerciseId, t.gymWeightKg);
          }
        });

        const log = dailyLogs[dStr];
        if (log?.weights) {
          Object.entries(log.weights).forEach(([exId, w]) => recordAutoWeight(exId, w));
        }
      });

      const cappedAutoSessions = Math.min(targetSessionsPerWeek, autoSessionsCount);
      const sessionsCount =
        checkin.sessionsOverride !== null && checkin.sessionsOverride !== undefined
          ? Math.min(targetSessionsPerWeek, Math.max(0, Number(checkin.sessionsOverride)))
          : cappedAutoSessions;
      const cleanEatingDays =
        checkin.cleanEatingOverride !== null && checkin.cleanEatingOverride !== undefined
          ? Math.min(7, Math.max(0, Number(checkin.cleanEatingOverride)))
          : autoCleanEatingDays;
      const stepsSleepDays =
        checkin.stepsSleepOverride !== null && checkin.stepsSleepOverride !== undefined
          ? Math.min(7, Math.max(0, Number(checkin.stepsSleepOverride)))
          : autoStepsSleepDays;

      const weightKg = parseNullableNumber(checkin.weightKg);
      const waistCm = parseNullableNumber(checkin.waistCm);
      const strengthTrend = String(checkin.strengthTrend || checkin.strengthFeel || '').trim();
      const note = String(checkin.note || '');

      const weightDelta =
        weightKg !== null && baseline.weightKg !== null ? round1(weightKg - baseline.weightKg) : null;
      const waistDelta =
        waistCm !== null && baseline.waistCm !== null ? round1(waistCm - baseline.waistCm) : null;

      const keyLiftWeights = {};
      const keyLiftSources = {};
      let loggedKeyLiftsCount = 0;

      KEY_LIFTS_12.forEach((kl) => {
        const explicitVal =
          parsePositiveWeight(checkin.keyLiftWeights?.[kl.exerciseId]) ??
          parsePositiveWeight(checkin.keyLiftWeights?.[kl.altExerciseId]);
        const autoVal = parsePositiveWeight(weekAutoWeights[kl.exerciseId]);
        if (explicitVal !== null) {
          keyLiftWeights[kl.exerciseId] = explicitVal;
          keyLiftSources[kl.exerciseId] = 'manual';
          loggedKeyLiftsCount += 1;
        } else if (autoVal !== null) {
          keyLiftWeights[kl.exerciseId] = autoVal;
          keyLiftSources[kl.exerciseId] = 'auto';
          loggedKeyLiftsCount += 1;
        } else {
          keyLiftWeights[kl.exerciseId] = null;
          keyLiftSources[kl.exerciseId] = 'none';
        }
      });

      const hasCheckinInput = Boolean(
        weightKg !== null ||
          waistCm !== null ||
          strengthTrend ||
          note.trim() ||
          loggedKeyLiftsCount > 0 ||
          (checkin.sessionsOverride !== null && checkin.sessionsOverride !== undefined)
      );
      const hasActivity = Boolean(weekHasDailyActivity || hasCheckinInput);

      const adviceObj = computeWeeklyAdvice({
        weekNum,
        hasActivity,
        sessionsCount: hasActivity ? sessionsCount : null,
        cleanEatingDays: hasActivity ? cleanEatingDays : null,
        waistDelta,
        strengthTrend,
        targetSessionsPerWeek
      });

      weeks.push({
        weekNum,
        code: weekNum === 9 ? 'T9 - Deload' : `T${weekNum}`,
        shortCode: `T${weekNum}`,
        isDeload: weekNum === 9,
        mondayDate,
        sundayDate,
        dates,
        targetSessions: targetSessionsPerWeek,
        sessionsCount,
        autoSessionsCount: cappedAutoSessions,
        cleanEatingDays,
        autoCleanEatingDays,
        stepsSleepDays,
        autoStepsSleepDays,
        greenDays,
        yellowDays,
        redDays,
        hasActivity,
        weightKg,
        waistCm,
        weightDelta,
        waistDelta,
        strengthTrend,
        note,
        advice: adviceObj.text,
        adviceTone: adviceObj.tone,
        loggedKeyLiftsCount,
        keyLiftWeights,
        keyLiftSources
      });
    }

    let keyLiftsProgressedCount = 0;
    let totalKeyLiftGainKg = 0;

    const keyLiftsSummary = KEY_LIFTS_12.map((kl) => {
      const weeklyWeights = {};
      let startWeightKg = null;
      let bestWeightKg = null;
      let latestWeightKg = null;

      weeks.forEach((wk) => {
        const val = wk.keyLiftWeights[kl.exerciseId];
        weeklyWeights[wk.weekNum] = val;
        if (val !== null) {
          if (startWeightKg === null) startWeightKg = val;
          if (bestWeightKg === null || val > bestWeightKg) bestWeightKg = val;
          latestWeightKg = val;
        }
      });

      const gainKg =
        startWeightKg !== null && bestWeightKg !== null ? round1(bestWeightKg - startWeightKg) : null;
      if (gainKg !== null && gainKg > 0) {
        keyLiftsProgressedCount += 1;
        totalKeyLiftGainKg = round1(totalKeyLiftGainKg + gainKg) || 0;
      }

      return {
        ...kl,
        weeklyWeights,
        startWeightKg,
        bestWeightKg,
        latestWeightKg,
        gainKg
      };
    });

    const activeWeeks = weeks.filter((w) => w.hasActivity);
    const totalSessions = weeks.reduce((acc, w) => acc + (w.hasActivity ? w.sessionsCount : 0), 0);
    const reviewedWeeks = activeWeeks.length;
    const attendancePct =
      reviewedWeeks > 0 ? Math.min(100, Math.round((totalSessions / (reviewedWeeks * targetSessionsPerWeek)) * 100)) : 0;
    const totalGreenDays = weeks.reduce((acc, w) => acc + w.greenDays, 0);

    const avgCleanEatingDays =
      reviewedWeeks > 0
        ? round1(activeWeeks.reduce((acc, w) => acc + w.cleanEatingDays, 0) / reviewedWeeks)
        : null;
    const avgStepsSleepDays =
      reviewedWeeks > 0
        ? round1(activeWeeks.reduce((acc, w) => acc + w.stepsSleepDays, 0) / reviewedWeeks)
        : null;

    const latestWeightWeek = [...weeks].reverse().find((w) => w.weightKg !== null) || null;
    const latestWaistWeek = [...weeks].reverse().find((w) => w.waistCm !== null) || null;

    const totals = {
      activePlanMode: planModeKey,
      targetSessionsPerWeek,
      totalSessions,
      reviewedWeeks,
      attendancePct,
      latestWeightKg: latestWeightWeek ? latestWeightWeek.weightKg : null,
      weightDeltaFromT0: latestWeightWeek ? latestWeightWeek.weightDelta : null,
      latestWaistCm: latestWaistWeek ? latestWaistWeek.waistCm : null,
      waistDeltaFromT0: latestWaistWeek ? latestWaistWeek.waistDelta : null,
      totalGreenDays,
      avgCleanEatingDays,
      avgStepsSleepDays,
      keyLiftsProgressedCount,
      totalKeyLiftGainKg
    };

    // Permanent day-by-day archive across EVERY date with gym/habit data
    const allArchiveDates = new Set(Object.keys(dailyLogs));
    safeTasks.forEach((t) => {
      const d = getTaskDateStr(t);
      if (!d) return;
      if (t.gymType === 'habit' || t.gymType === 'exercise' || resolveHabitIdFromTask(t)) {
        allArchiveDates.add(d);
      }
    });

    const dailyHistory = Array.from(allArchiveDates)
      .filter((d) => Boolean(parseIsoDate(d)))
      .sort((a, b) => b.localeCompare(a))
      .map((dateStr) => {
        const dayTasks = tasksByDate.get(dateStr) || [];
        const summary = getDayHabitSummary(dateStr, normalized, dayTasks);
        const log = dailyLogs[dateStr] || null;

        const weightByEx = new Map();
        if (log?.weights) {
          Object.entries(log.weights).forEach(([exId, w]) => {
            const parsed = parsePositiveWeight(w);
            if (parsed !== null) {
              const meta = exerciseMetaMap.get(exId);
              const canonicalId = meta?.id || exId;
              weightByEx.set(canonicalId, {
                exerciseId: canonicalId,
                name: meta?.name || exId,
                weightKg: parsed,
                isKey: Boolean(meta?.isKey)
              });
            }
          });
        }
        dayTasks.forEach((t) => {
          if (t.gymType !== 'exercise') return;
          const parsed = parsePositiveWeight(t.gymWeightKg);
          if (parsed === null) return;
          const exId = t.gymExerciseId || t.id;
          const meta = exerciseMetaMap.get(exId);
          const canonicalId = meta?.id || exId;
          weightByEx.set(canonicalId, {
            exerciseId: canonicalId,
            name: t.title || meta?.name || exId,
            weightKg: parsed,
            isKey: Boolean(t.gymIsKey || meta?.isKey)
          });
        });

        const allWeightsLogged = Array.from(weightByEx.values());
        const keyLiftsLogged = allWeightsLogged.filter((item) => item.isKey);

        return {
          dateStr,
          weekNum: getWeekNumberForDate(dateStr, planStartSunday),
          doneCount: summary.doneCount,
          totalCount: 6,
          status: summary.status,
          label: summary.label,
          cleanEating: summary.cleanEating,
          stepsSleep: summary.stepsSleep,
          workoutDone: summary.workoutDone,
          habitsMap: summary.habitsMap,
          workoutGroupId: summary.workoutGroupId,
          workoutGroupName: summary.workoutGroupName,
          exerciseDoneCount: summary.exerciseDoneCount,
          exerciseTotalCount: summary.exerciseTotalCount,
          setsDone: summary.setsDone,
          setsTarget: summary.setsTarget,
          keyLiftsLogged,
          allWeightsLogged,
          note: log?.note || ''
        };
      })
      .filter((entry) => {
        const log = dailyLogs[entry.dateStr];
        return Boolean(
          entry.exerciseTotalCount > 0 ||
          entry.setsDone > 0 ||
          entry.setsTarget > 0 ||
          entry.doneCount > 0 ||
          entry.workoutDone ||
          entry.allWeightsLogged.length > 0 ||
          (entry.note && entry.note.trim()) ||
          (entry.workoutGroupName && !(log && log.clearedWorkout))
        );
      });

    return {
      activePlanMode: planModeKey,
      targetSessionsPerWeek,
      baseline,
      planStartSunday,
      weeks,
      totals,
      keyLiftsSummary,
      dailyHistory
    };
  }

  // ==========================================
  // ACCOUNT SHEETS BUILDER (24/7 GIST & LOCAL)
  // ==========================================
  function formatSigned(val, suffix) {
    if (val === null || val === undefined || !Number.isFinite(val)) return '';
    const sign = val > 0 ? '+' : '';
    return `${sign}${val}${suffix || ''}`;
  }

  function buildGymAccountSheets(gymData, tasks) {
    const analytics = computeWeeklyAnalytics(gymData, tasks || []);
    const { baseline, weeks, totals, keyLiftsSummary, targetSessionsPerWeek } = analytics;
    const targetSessions = targetSessionsPerWeek || 6;
    const now = Date.now();

    const weeklyReviewRows = [
      {
        id: 'gym_wk_0',
        week: 'T0 - InBody 25/10',
        sundayDate: formatVnDateFull(baseline.date),
        sessions: '-',
        cleanEating: '-',
        stepsSleep: '-',
        greenDays: '-',
        weightKg: baseline.weightKg !== null ? String(baseline.weightKg) : '',
        waistCm: baseline.waistCm !== null ? String(baseline.waistCm) : '',
        weightDelta: 'Mốc gốc',
        waistDelta: 'Mốc gốc',
        strengthTrend: '-',
        advice: `InBody gốc: SMM ${baseline.smmKg} kg | Mỡ ${baseline.fatKg} kg (${baseline.pbfPct}%) | Mỡ bụng ${baseline.trunkFatKg} kg`,
        note: 'Đích 6 múi: ~67.2 kg · SMM 33.7 kg · PBF 12.9%'
      },
      ...weeks.map((wk) => ({
        id: `gym_wk_${wk.weekNum}`,
        week: wk.code,
        sundayDate: formatVnDateFull(wk.sundayDate),
        sessions: wk.hasActivity ? `${wk.sessionsCount}/${targetSessions}` : '',
        cleanEating: wk.hasActivity ? `${wk.cleanEatingDays}/7` : '',
        stepsSleep: wk.hasActivity ? `${wk.stepsSleepDays}/7` : '',
        greenDays: wk.hasActivity ? String(wk.greenDays) : '',
        weightKg: wk.weightKg !== null ? String(wk.weightKg) : '',
        waistCm: wk.waistCm !== null ? String(wk.waistCm) : '',
        weightDelta: formatSigned(wk.weightDelta, ' kg'),
        waistDelta: formatSigned(wk.waistDelta, ' cm'),
        strengthTrend: wk.strengthTrend || '',
        advice: wk.hasActivity ? wk.advice : '',
        note: wk.note || ''
      })),
      {
        id: 'gym_wk_summary',
        week: 'TỔNG / TB',
        sundayDate: `${totals.reviewedWeeks}/12 tuần`,
        sessions: `${totals.totalSessions} buổi (${totals.attendancePct}%)`,
        cleanEating: totals.avgCleanEatingDays !== null ? `TB ${totals.avgCleanEatingDays}/7` : '',
        stepsSleep: totals.avgStepsSleepDays !== null ? `TB ${totals.avgStepsSleepDays}/7` : '',
        greenDays: `${totals.totalGreenDays} ngày`,
        weightKg: totals.latestWeightKg !== null ? String(totals.latestWeightKg) : '',
        waistCm: totals.latestWaistCm !== null ? String(totals.latestWaistCm) : '',
        weightDelta: formatSigned(totals.weightDeltaFromT0, ' kg'),
        waistDelta: formatSigned(totals.waistDeltaFromT0, ' cm'),
        strengthTrend: `${totals.keyLiftsProgressedCount}/12 bài tăng tạ`,
        advice: `Tổng tăng 12 bài ★: ${formatSigned(totals.totalKeyLiftGainKg, ' kg')}`,
        note: 'Đồng bộ tự động từ Checklist Gym Plan'
      }
    ];

    const weeklyReviewSheet = {
      id: 'sheet_gym_weekly_review',
      name: 'Gym · Review 12 Tuần',
      icon: '🏋️',
      defaultUrl: '',
      updatedAt: now,
      columns: [
        { id: 'week', name: 'Tuần', width: 130, type: 'text' },
        { id: 'sundayDate', name: 'Ngày CN', width: 112, type: 'text' },
        { id: 'sessions', name: `Buổi tập (/${targetSessions})`, width: 115, type: 'text' },
        { id: 'cleanEating', name: 'Ăn chuẩn (/7)', width: 115, type: 'text' },
        { id: 'stepsSleep', name: '8k bước & Ngủ (/7)', width: 138, type: 'text' },
        { id: 'greenDays', name: 'Ngày Xanh', width: 95, type: 'text' },
        { id: 'weightKg', name: 'Cân CN (kg)', width: 105, type: 'text' },
        { id: 'waistCm', name: 'Vòng eo (cm)', width: 110, type: 'text' },
        { id: 'weightDelta', name: 'Đổi Cân T0', width: 105, type: 'text' },
        { id: 'waistDelta', name: 'Đổi Eo T0', width: 105, type: 'text' },
        { id: 'strengthTrend', name: 'Mức tạ tuần', width: 120, type: 'text' },
        { id: 'advice', name: 'Gợi ý điều chỉnh tự động', width: 320, type: 'text' },
        { id: 'note', name: 'Ghi chú tuần', width: 220, type: 'text' }
      ],
      rows: weeklyReviewRows
    };

    const weightLogRows = [
      ...keyLiftsSummary.map((kl) => {
        const row = {
          id: `gym_kl_${kl.keyLiftIndex}`,
          session: kl.session,
          name: `★ ${kl.name}`,
          machine: kl.machine,
          target: kl.target
        };
        for (let w = 1; w <= 12; w += 1) {
          const val = kl.weeklyWeights[w];
          row[`t${w}`] = val !== null && val !== undefined ? String(val) : '';
        }
        row.startKg = kl.startWeightKg !== null ? String(kl.startWeightKg) : '';
        row.bestKg = kl.bestWeightKg !== null ? String(kl.bestWeightKg) : '';
        row.gainKg = formatSigned(kl.gainKg, ' kg');
        return row;
      }),
      (() => {
        const summaryRow = {
          id: 'gym_kl_summary',
          session: 'TỔNG KẾT',
          name: 'Số bài đã log mỗi tuần (/12 bài)',
          machine: 'Double Progression: đạt rep đỉnh -> +2.5 kg',
          target: `${totals.keyLiftsProgressedCount}/12 tăng`
        };
        for (let w = 1; w <= 12; w += 1) {
          const wk = weeks[w - 1];
          summaryRow[`t${w}`] = wk ? `${wk.loggedKeyLiftsCount}/12` : '0/12';
        }
        summaryRow.startKg = '';
        summaryRow.bestKg = `${totals.keyLiftsProgressedCount} bài tăng`;
        summaryRow.gainKg = formatSigned(totals.totalKeyLiftGainKg, ' kg');
        return summaryRow;
      })()
    ];

    const weightLogSheet = {
      id: 'sheet_gym_weight_log',
      name: 'Gym · Log Tạ 12 Bài ★',
      icon: '⭐',
      defaultUrl: '',
      updatedAt: now,
      columns: [
        { id: 'session', name: 'Buổi', width: 112, type: 'text' },
        { id: 'name', name: 'Bài tập chủ chốt ★', width: 270, type: 'text' },
        { id: 'machine', name: 'Máy tập', width: 215, type: 'text' },
        { id: 'target', name: 'Mục tiêu', width: 96, type: 'text' },
        { id: 't1', name: 'T1 (kg)', width: 76, type: 'text' },
        { id: 't2', name: 'T2 (kg)', width: 76, type: 'text' },
        { id: 't3', name: 'T3 (kg)', width: 76, type: 'text' },
        { id: 't4', name: 'T4 (kg)', width: 76, type: 'text' },
        { id: 't5', name: 'T5 (kg)', width: 76, type: 'text' },
        { id: 't6', name: 'T6 (kg)', width: 76, type: 'text' },
        { id: 't7', name: 'T7 (kg)', width: 76, type: 'text' },
        { id: 't8', name: 'T8 (kg)', width: 76, type: 'text' },
        { id: 't9', name: 'T9 Deload', width: 82, type: 'text' },
        { id: 't10', name: 'T10 (kg)', width: 78, type: 'text' },
        { id: 't11', name: 'T11 (kg)', width: 78, type: 'text' },
        { id: 't12', name: 'T12 (kg)', width: 78, type: 'text' },
        { id: 'startKg', name: 'Mốc đầu', width: 88, type: 'text' },
        { id: 'bestKg', name: 'Tốt nhất', width: 88, type: 'text' },
        { id: 'gainKg', name: 'Tăng (+kg)', width: 95, type: 'text' }
      ],
      rows: weightLogRows
    };

    return [weeklyReviewSheet, weightLogSheet];
  }

  // ==========================================
  // TASK FACTORY HELPERS (IDEMPOTENT & CLEAN)
  // ==========================================
  function createHabitTasksForDate(dateStr, gymData, existingTasks) {
    const targetDate = dateStr ? String(dateStr).slice(0, 10) : getTodayDateStr();
    const normalized = normalizeGymData(gymData);
    const safeTasks = Array.isArray(existingTasks) ? existingTasks : [];
    const dailyLogHabits = normalized.dailyLogs[targetDate]?.habits || {};

    const existingHabitIds = new Set();
    safeTasks.forEach((t) => {
      if (getTaskDateStr(t) !== targetDate) return;
      const hid = resolveHabitIdFromTask(t);
      if (hid) existingHabitIds.add(hid);
    });

    const now = Date.now();
    const newTasks = [];

    normalized.dailyHabitsTemplate.forEach((habit, idx) => {
      if (existingHabitIds.has(habit.id)) return;
      const alreadyDone = Boolean(dailyLogHabits[habit.id]);
      newTasks.push({
        id: `task_gym_habit_${targetDate}_${habit.id}_${now}_${idx}`,
        title: habit.title,
        date: targetDate,
        dateKey: targetDate,
        time: '',
        dueTime: '',
        category: 'cat_personal',
        priority: habit.category === 'workout' ? 'high' : 'medium',
        repeat: 'none',
        note: habit.note || '',
        completed: alreadyDone,
        completedAt: alreadyDone ? new Date(now).toISOString() : null,
        createdAt: now + idx,
        updatedAt: now + idx,
        gymType: 'habit',
        gymHabitId: habit.id,
        gymHabitCategory: habit.category,
        gymOrder: habit.order || idx + 1
      });
    });

    return newTasks;
  }

  function createWorkoutTasksForDate(dateStr, group, existingTasks, gymData) {
    const targetDate = dateStr ? String(dateStr).slice(0, 10) : getTodayDateStr();
    if (!group || !Array.isArray(group.exercises)) {
      return { tasksToAdd: [], replacedIds: [] };
    }

    const safeTasks = Array.isArray(existingTasks) ? existingTasks : [];
    const existingOnDate = safeTasks.filter(
      (t) => t && getTaskDateStr(t) === targetDate && t.gymType === 'exercise'
    );

    const replacedIds = existingOnDate.filter((t) => !t.completed).map((t) => t.id);
    const completedExerciseIds = new Set(
      existingOnDate.filter((t) => t.completed && t.gymExerciseId).map((t) => canonicalizeExerciseId(t.gymExerciseId))
    );
    const dayLog = gymData?.dailyLogs?.[targetDate] || null;
    const existingLogWeights = dayLog?.weights || {};
    const existingLogSetProgress = dayLog?.setProgress || {};

    const now = Date.now();
    const tasksToAdd = [];

    group.exercises.forEach((ex, idx) => {
      if (!ex || !ex.name) return;
      const exId = ex.id || `${group.id}_ex_${idx + 1}`;
      const canonExId = canonicalizeExerciseId(exId);
      if (canonExId && completedExerciseIds.has(canonExId)) return;

      const rawSets = Number(ex.sets);
      const displaySets = Number.isFinite(rawSets) && rawSets > 0 ? Math.round(rawSets) : 0;
      const setsNum = displaySets > 0 ? displaySets : (rawSets === 0 ? 1 : 3);
      const setsReps = displaySets > 0 ? `${displaySets} × ${ex.reps || '10-12'}` : (ex.reps || '');
      const rirPart = ex.rir ? ` · RIR ${ex.rir}` : '';
      const restPart = ex.rest && ex.rest !== '-' ? ` · Nghỉ ${ex.rest}` : '';
      const prevWeight = gymData ? getLatestExerciseWeight(gymData, safeTasks, exId, targetDate) : null;

      let loggedTodayWeight = null;
      let savedSetChecks = null;
      const aliases = getExerciseIdAliases(exId);
      for (let i = 0; i < aliases.length; i += 1) {
        const aid = aliases[i];
        if (loggedTodayWeight === null) {
          const w = parsePositiveWeight(existingLogWeights[aid]);
          if (w !== null) loggedTodayWeight = w;
        }
        if (savedSetChecks === null && Array.isArray(existingLogSetProgress[aid]) && existingLogSetProgress[aid].length > 0) {
          savedSetChecks = existingLogSetProgress[aid];
        }
      }

      const gymSetChecks = savedSetChecks
        ? normalizeExerciseSetChecks({ gymSets: setsNum, gymSetChecks: savedSetChecks, completed: false })
        : Array(setsNum).fill(false);
      const isAllSetsDone = gymSetChecks.every(Boolean);

      const noteParts = [];
      if (ex.machine) noteParts.push(`Máy: ${ex.machine}`);
      if (setsReps || restPart) noteParts.push(`${setsReps}${rirPart}${restPart}`.trim());
      if (ex.alt) noteParts.push(`Thay thế: ${ex.alt}`);
      if (prevWeight !== null) noteParts.push(`Lần trước: ${prevWeight} kg`);

      tasksToAdd.push({
        id: `task_gym_ex_${targetDate}_${group.id}_${ex.id || idx}_${now}_${idx}`,
        title: ex.name,
        date: targetDate,
        dateKey: targetDate,
        time: '',
        dueTime: '',
        category: 'cat_personal',
        priority: ex.isKey ? 'high' : 'medium',
        repeat: 'none',
        note: noteParts.join(' | '),
        completed: isAllSetsDone,
        completedAt: isAllSetsDone ? new Date(now).toISOString() : null,
        createdAt: now + idx,
        updatedAt: now + idx,
        gymType: 'exercise',
        gymGroupId: group.id,
        gymGroupName: group.name,
        gymExerciseId: exId,
        gymIsKey: Boolean(ex.isKey),
        gymKeyLiftIndex: ex.keyLiftIndex || null,
        gymMachine: ex.machine || '',
        gymAlt: ex.alt || '',
        gymSets: setsNum,
        gymSetChecks,
        gymReps: ex.reps || '',
        gymRest: ex.rest || '',
        gymSetsReps: setsReps,
        gymWeightKg: loggedTodayWeight,
        gymOrder: ex.order || idx + 1
      });
    });

    return { tasksToAdd, replacedIds };
  }

  function buildGymReviewCsv(gymData, tasks) {
    const [weeklySheet, weightSheet] = buildGymAccountSheets(gymData, tasks || []);
    const esc = (v) => {
      const str = String(v ?? '');
      if (/[",\r\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const lines = [];
    lines.push(esc('=== REVIEW 12 TUẦN — TĂNG CƠ & GIẢM MỠ BỤNG 6 MÚI ==='));
    lines.push(weeklySheet.columns.map((c) => esc(c.name)).join(','));
    weeklySheet.rows.forEach((row) => {
      lines.push(weeklySheet.columns.map((c) => esc(row[c.id])).join(','));
    });

    lines.push('');
    lines.push(esc('=== LOG TẠ 12 BÀI CHỦ LỰC ★ (KG) ==='));
    lines.push(weightSheet.columns.map((c) => esc(c.name)).join(','));
    weightSheet.rows.forEach((row) => {
      lines.push(weightSheet.columns.map((c) => esc(row[c.id])).join(','));
    });

    return `\uFEFF${lines.join('\r\n')}`;
  }

  // ==========================================
  // PUBLIC API (window.GymPlan)
  // ==========================================
  const GymPlan = {
    GYM_STORAGE_KEY,
    PLAN_START_SUNDAY,
    DEFAULT_PLAN_MODE,
    PLAN_MODES,
    DEFAULT_BASELINE,
    DAILY_HABITS_TEMPLATE,
    DEFAULT_WORKOUT_GROUPS,
    KEY_LIFTS_12,
    STRENGTH_TREND_OPTIONS,
    cloneWorkoutGroup,
    getDefaultGymData,
    normalizeGymData,
    mergeGymData,
    getSuggestedGroupForDate,
    getWeekDates,
    getWeekNumberForDate,
    getLatestExerciseWeight,
    getLatestExerciseWeightEntry,
    getDayHabitSummary,
    computeWeeklyAdvice,
    computeWeeklyAnalytics,
    buildGymAccountSheets,
    createHabitTasksForDate,
    createWorkoutTasksForDate,
    normalizeExerciseSetChecks,
    canonicalizeExerciseId,
    buildGymReviewCsv,
    resolveHabitIdFromTask,
    parseNullableNumber,
    parsePositiveWeight,
    formatVnDateShort,
    formatVnDateFull,
    getVnDayLabel,
    formatSigned
  };

  if (typeof root !== 'undefined') {
    root.GymPlan = GymPlan;
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = GymPlan;
  }
})(typeof window !== 'undefined' ? window : globalThis);
