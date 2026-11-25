/**
 * Gym Plan 6 Buổi (PPL A/B) — Canonical Data, Analytics & 2-Way Merge Engine
 * Standalone browser script attaching window.GymPlan (zero ES module imports needed for PWA + SW).
 * 100% schema-aligned with gym_data.json on GitHub Gist, Desktop Frontend (gymPlanData.js),
 * Backend (gymDatabaseService.js), and Excel (03_WEEKLY_REVIEW_DON_GIAN.xlsx).
 */
(function (root) {
  'use strict';

  const GYM_STORAGE_KEY = 'pcl_gym_data_v1';

  // Sunday of Week 1 (T1) — matches Sheet 1_Review_Cuoi_Tuan cell B11 (2026-11-01)
  const PLAN_START_SUNDAY = '2026-11-01';

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

  // Verbatim 6 built-in sessions (40 exercises, 119 sets, 12 ★ key lifts) + Sunday rest
  // Exact match to Sheet 2_Lich_Tap_6_Buoi Rows 6..45
  const DEFAULT_WORKOUT_GROUPS = [
    {
      id: 'push_a',
      name: 'T2 - Push A',
      shortName: 'Push A',
      shortDay: 'T2',
      dayOfWeek: 1,
      dayLabel: 'Thứ Hai',
      focus: 'Ngực trên/ngang + Vai ngang + Tay sau',
      priorityNote: '',
      isRestDay: false,
      isBuiltIn: true,
      priorityLegs: false,
      color: '#10b981',
      exercises: [
        {
          id: 'ex_push_a_1',
          order: 1,
          stt: 1,
          isKey: true,
          keyLiftIndex: 1,
          excelRow: 6,
          name: 'Incline Chest Press Machine',
          machine: 'Máy đẩy ngực trên ngồi (Hammer Strength / Technogym)',
          alt: 'Smith Machine Incline Press 30° / Incline DB Press',
          sets: 3,
          reps: '8-10',
          rir: '1-2',
          rest: '2.5-3p'
        },
        {
          id: 'ex_push_a_2',
          order: 2,
          stt: 2,
          isKey: false,
          keyLiftIndex: null,
          excelRow: null,
          name: 'Flat Converging Chest Press Machine',
          machine: 'Máy đẩy ngực ngang hội tụ (Converging Chest Press)',
          alt: 'Smith Machine Flat Press / Dumbbell Bench Press',
          sets: 3,
          reps: '8-12',
          rir: '1-2',
          rest: '2-2.5p'
        },
        {
          id: 'ex_push_a_3',
          order: 3,
          stt: 3,
          isKey: false,
          keyLiftIndex: null,
          excelRow: null,
          name: 'Pec Deck Fly Machine',
          machine: 'Máy ép ngực bướm (Pec Deck / Butterfly)',
          alt: 'Seated Cable Chest Fly',
          sets: 3,
          reps: '12-15',
          rir: '0-1',
          rest: '90s'
        },
        {
          id: 'ex_push_a_4',
          order: 4,
          stt: 4,
          isKey: true,
          keyLiftIndex: 2,
          excelRow: 7,
          name: 'Machine Lateral Raise',
          machine: 'Máy dang vai ngang ngồi (Lateral Raise Machine)',
          alt: 'Cable Lateral Raise (ròng rọc ngang đùi)',
          sets: 4,
          reps: '12-15',
          rir: '0-1',
          rest: '60-90s'
        },
        {
          id: 'ex_push_a_5',
          order: 5,
          stt: 5,
          isKey: false,
          keyLiftIndex: null,
          excelRow: null,
          name: 'Overhead Cable Triceps Extension',
          machine: 'Máy kéo cáp đa năng + dây thừng (Cable Tower Rope)',
          alt: 'Triceps Extension Machine',
          sets: 3,
          reps: '10-14',
          rir: '0-1',
          rest: '90s'
        },
        {
          id: 'ex_push_a_6',
          order: 6,
          stt: 6,
          isKey: false,
          keyLiftIndex: null,
          excelRow: null,
          name: 'Cable Triceps Pushdown (V-Bar)',
          machine: 'Máy kéo cáp cao + thanh chữ V (Cable Pushdown)',
          alt: 'Assisted Dip Machine (thân thẳng)',
          sets: 2,
          reps: '10-12',
          rir: '0-1',
          rest: '90s'
        }
      ]
    },
    {
      id: 'pull_a',
      name: 'T3 - Pull A',
      shortName: 'Pull A',
      shortDay: 'T3',
      dayOfWeek: 2,
      dayLabel: 'Thứ Ba',
      focus: 'Xô rộng + Lưng trên + Vai sau + Tay trước + Bụng A (Cáp)',
      priorityNote: '',
      isRestDay: false,
      isBuiltIn: true,
      priorityLegs: false,
      color: '#06b6d4',
      exercises: [
        {
          id: 'ex_pull_a_1',
          order: 1,
          stt: 1,
          isKey: true,
          keyLiftIndex: 3,
          excelRow: 8,
          name: 'Lat Pulldown Machine (Mid/Neutral Grip)',
          machine: 'Máy kéo xô trên (Lat Pulldown / Mag-Grip)',
          alt: 'Assisted Pull-Up Machine',
          sets: 3,
          reps: '8-12',
          rir: '1-2',
          rest: '2-2.5p'
        },
        {
          id: 'ex_pull_a_2',
          order: 2,
          stt: 2,
          isKey: false,
          keyLiftIndex: null,
          excelRow: null,
          name: 'Chest-Supported Row Machine (Wide/45°)',
          machine: 'Máy kéo lưng có đệm ngực (Chest-Supported Row)',
          alt: 'Seated Cable Row (tay cầm rộng)',
          sets: 3,
          reps: '8-12',
          rir: '1-2',
          rest: '2-2.5p'
        },
        {
          id: 'ex_pull_a_3',
          order: 3,
          stt: 3,
          isKey: false,
          keyLiftIndex: null,
          excelRow: null,
          name: 'Straight-Arm Cable Lat Pullover',
          machine: 'Máy kéo cáp cao thẳng tay (Cable Tower)',
          alt: 'Machine Pullover (Nautilus Pullover)',
          sets: 3,
          reps: '12-15',
          rir: '0-1',
          rest: '90s'
        },
        {
          id: 'ex_pull_a_4',
          order: 4,
          stt: 4,
          isKey: false,
          keyLiftIndex: null,
          excelRow: null,
          name: 'Reverse Pec Deck Machine',
          machine: 'Máy ép vai sau (Rear Delt Fly / Reverse Pec Deck)',
          alt: 'Cable Face Pull',
          sets: 3,
          reps: '12-15',
          rir: '0-1',
          rest: '60-90s'
        },
        {
          id: 'ex_pull_a_5',
          order: 5,
          stt: 5,
          isKey: false,
          keyLiftIndex: null,
          excelRow: null,
          name: 'Preacher Curl Machine',
          machine: 'Máy cuốn tay trước có bệ tỳ (Preacher Curl Machine)',
          alt: 'EZ-Bar Preacher Curl',
          sets: 3,
          reps: '10-12',
          rir: '0-1',
          rest: '90s'
        },
        {
          id: 'ex_pull_a_6',
          order: 6,
          stt: 6,
          isKey: false,
          keyLiftIndex: null,
          excelRow: null,
          name: 'Behind-the-Back Cable Curl',
          machine: 'Máy kéo cáp đơn ròng rọc thấp (Single-Arm Cable)',
          alt: 'Incline Dumbbell Curl (ghế 45°)',
          sets: 2,
          reps: '12-15',
          rir: '0-1',
          rest: '60-90s'
        },
        {
          id: 'ex_pull_a_7',
          order: 7,
          stt: 7,
          isKey: true,
          keyLiftIndex: 4,
          excelRow: 9,
          name: '[Bụng A] Weighted Cable Crunch',
          machine: 'Máy kéo cáp cao + dây thừng (Quỳ gập bụng có tạ)',
          alt: 'Seated Ab Crunch Machine',
          sets: 3,
          reps: '12-15',
          rir: '0-1',
          rest: '60-90s'
        }
      ]
    },
    {
      id: 'legs_a',
      name: 'T4 - Legs A',
      shortName: 'Legs A',
      shortDay: 'T4',
      dayOfWeek: 3,
      dayLabel: 'Thứ Tư',
      focus: 'Ưu tiên không bỏ buổi Chân vì InBody Chân đang 98.1% / 99.4% (<100%) — Trọng tâm Đùi trước & Bắp chân',
      priorityNote: 'KHÔNG BỎ BUỔI NÀY — Kéo cơ 2 chân từ 98–99% lên >100%!',
      isRestDay: false,
      isBuiltIn: true,
      priorityLegs: true,
      color: '#f59e0b',
      exercises: [
        {
          id: 'ex_legs_a_1',
          order: 1,
          stt: 1,
          isKey: true,
          keyLiftIndex: 5,
          excelRow: 10,
          name: 'Hack Squat Machine',
          machine: 'Máy Squat trượt nghiêng 45° (Hack / Pendulum Squat)',
          alt: 'Smith Machine Squat (chân đặt hơi trước)',
          sets: 3,
          reps: '8-10',
          rir: '1-2',
          rest: '3p'
        },
        {
          id: 'ex_legs_a_2',
          order: 2,
          stt: 2,
          isKey: false,
          keyLiftIndex: null,
          excelRow: null,
          name: '45° Leg Press Machine (chân thấp-giữa)',
          machine: 'Máy đạp đùi 45° (Leg Press Machine)',
          alt: 'Horizontal Leg Press Machine',
          sets: 3,
          reps: '10-12',
          rir: '1-2',
          rest: '2.5p'
        },
        {
          id: 'ex_legs_a_3',
          order: 3,
          stt: 3,
          isKey: true,
          keyLiftIndex: 6,
          excelRow: 11,
          name: 'Seated Leg Curl Machine',
          machine: 'Máy móc đùi sau ngồi (Seated Leg Curl)',
          alt: 'Lying Leg Curl Machine',
          sets: 3,
          reps: '10-12',
          rir: '0-1',
          rest: '90s-2p'
        },
        {
          id: 'ex_legs_a_4',
          order: 4,
          stt: 4,
          isKey: false,
          keyLiftIndex: null,
          excelRow: null,
          name: 'Leg Extension Machine',
          machine: 'Máy đá đùi trước ngồi (Leg Extension Machine)',
          alt: 'Sissy Squat / Smith Split Squat',
          sets: 3,
          reps: '12-15',
          rir: '0-1',
          rest: '90s'
        },
        {
          id: 'ex_legs_a_5',
          order: 5,
          stt: 5,
          isKey: false,
          keyLiftIndex: null,
          excelRow: null,
          name: 'Hip Adductor Machine',
          machine: 'Máy khép đùi trong (Seated Hip Adduction)',
          alt: 'Cable Hip Adduction',
          sets: 3,
          reps: '12-15',
          rir: '0-1',
          rest: '60-90s'
        },
        {
          id: 'ex_legs_a_6',
          order: 6,
          stt: 6,
          isKey: false,
          keyLiftIndex: null,
          excelRow: null,
          name: 'Standing Calf Raise Machine',
          machine: 'Máy nhón bắp chân đứng (Standing Calf Raise)',
          alt: 'Calf Press trên máy Leg Press (chân thẳng)',
          sets: 4,
          reps: '10-15',
          rir: '0-1',
          rest: '60-90s'
        }
      ]
    },
    {
      id: 'push_b',
      name: 'T5 - Push B',
      shortName: 'Push B',
      shortDay: 'T5',
      dayOfWeek: 4,
      dayLabel: 'Thứ Năm',
      focus: 'Vai trước/ngang + Ngực trên Smith + Tay sau + Bụng B (Treo/Xà kép)',
      priorityNote: '',
      isRestDay: false,
      isBuiltIn: true,
      priorityLegs: false,
      color: '#10b981',
      exercises: [
        {
          id: 'ex_push_b_1',
          order: 1,
          stt: 1,
          isKey: true,
          keyLiftIndex: 7,
          excelRow: 12,
          name: 'Seated Shoulder Press Machine',
          machine: 'Máy đẩy vai ngồi (Converging Shoulder Press)',
          alt: 'Seated Dumbbell Shoulder Press / Smith OHP',
          sets: 3,
          reps: '8-10',
          rir: '1-2',
          rest: '2.5p'
        },
        {
          id: 'ex_push_b_2',
          order: 2,
          stt: 2,
          isKey: true,
          keyLiftIndex: 8,
          excelRow: 13,
          name: 'Smith Machine Incline Press (30°)',
          machine: 'Máy khung Smith + ghế chỉnh 30° (Incline Press)',
          alt: 'Plate-Loaded Incline Chest Press Machine',
          sets: 3,
          reps: '8-12',
          rir: '1-2',
          rest: '2.5p'
        },
        {
          id: 'ex_push_b_3',
          order: 3,
          stt: 3,
          isKey: false,
          keyLiftIndex: null,
          excelRow: null,
          name: 'Seated Cable Chest Fly (Low-to-High/Mid)',
          machine: 'Máy kéo cáp đôi đa năng (Dual Cable Crossover)',
          alt: 'Pec Deck Fly Machine',
          sets: 3,
          reps: '12-15',
          rir: '0-1',
          rest: '90s'
        },
        {
          id: 'ex_push_b_4',
          order: 4,
          stt: 4,
          isKey: false,
          keyLiftIndex: null,
          excelRow: null,
          name: 'Single-Arm Cable Lateral Raise',
          machine: 'Máy kéo cáp đơn ngang cổ tay (Cable Tower)',
          alt: 'Machine Lateral Raise',
          sets: 4,
          reps: '12-15',
          rir: '0-1',
          rest: '60-90s'
        },
        {
          id: 'ex_push_b_5',
          order: 5,
          stt: 5,
          isKey: false,
          keyLiftIndex: null,
          excelRow: null,
          name: 'Cable Triceps Pushdown (Straight Bar)',
          machine: 'Máy kéo cáp cao + thanh thẳng (Cable Tower)',
          alt: 'Seated Dip Machine',
          sets: 3,
          reps: '10-12',
          rir: '0-1',
          rest: '90s'
        },
        {
          id: 'ex_push_b_6',
          order: 6,
          stt: 6,
          isKey: false,
          keyLiftIndex: null,
          excelRow: null,
          name: 'Triceps Extension Machine',
          machine: 'Máy duỗi tay sau ngồi (Triceps Extension Machine)',
          alt: 'Single-Arm Overhead Cable Extension',
          sets: 2,
          reps: '12-15',
          rir: '0-1',
          rest: '60-90s'
        },
        {
          id: 'ex_push_b_7',
          order: 7,
          stt: 7,
          isKey: false,
          keyLiftIndex: null,
          excelRow: null,
          name: "[Bụng B] Captain's Chair / Hanging Leg Raise",
          machine: "Khung tập bụng xà kép tựa lưng (Captain's Chair)",
          alt: 'Xà đơn treo người cuộn gối/chân',
          sets: 3,
          reps: '10-15',
          rir: '0-1',
          rest: '60-90s'
        }
      ]
    },
    {
      id: 'pull_b',
      name: 'T6 - Pull B',
      shortName: 'Pull B',
      shortDay: 'T6',
      dayOfWeek: 5,
      dayLabel: 'Thứ Sáu',
      focus: 'Lưng dày + Xô trợ lực + Vai sau + Cẳng tay + Liên sườn',
      priorityNote: '',
      isRestDay: false,
      isBuiltIn: true,
      priorityLegs: false,
      color: '#06b6d4',
      exercises: [
        {
          id: 'ex_pull_b_1',
          order: 1,
          stt: 1,
          isKey: true,
          keyLiftIndex: 9,
          excelRow: 14,
          name: 'Seated Cable Row (Neutral Narrow)',
          machine: 'Máy kéo cáp ngồi tay hẹp ép hông (Seated Cable Row)',
          alt: 'Plate-Loaded ISO-Lateral Low Row',
          sets: 3,
          reps: '8-12',
          rir: '1-2',
          rest: '2.5p'
        },
        {
          id: 'ex_pull_b_2',
          order: 2,
          stt: 2,
          isKey: true,
          keyLiftIndex: 10,
          excelRow: 15,
          name: 'Assisted Pull-Up Machine',
          machine: 'Máy kéo xà trợ lực (Assisted Pull-Up/Dip)',
          alt: 'Lat Pulldown tay cầm trung tính hẹp',
          sets: 3,
          reps: '8-10',
          rir: '1-2',
          rest: '2.5p'
        },
        {
          id: 'ex_pull_b_3',
          order: 3,
          stt: 3,
          isKey: false,
          keyLiftIndex: null,
          excelRow: null,
          name: 'Chest-Supported T-Bar / High Row Machine',
          machine: 'Máy kéo lưng trên đệm ngực (T-Bar / High Row)',
          alt: 'Seated Row Machine (tay ngang ngực trên)',
          sets: 3,
          reps: '10-12',
          rir: '1-2',
          rest: '2p'
        },
        {
          id: 'ex_pull_b_4',
          order: 4,
          stt: 4,
          isKey: false,
          keyLiftIndex: null,
          excelRow: null,
          name: 'Cable Face Pull (Rope)',
          machine: 'Máy kéo cáp ngang mặt + dây thừng (Cable Tower)',
          alt: 'Reverse Pec Deck Machine',
          sets: 3,
          reps: '15-20',
          rir: '0-1',
          rest: '60-90s'
        },
        {
          id: 'ex_pull_b_5',
          order: 5,
          stt: 5,
          isKey: false,
          keyLiftIndex: null,
          excelRow: null,
          name: 'Cable Hammer Curl (Rope)',
          machine: 'Máy kéo cáp thấp + dây thừng (Cẳng tay & Bắp tay)',
          alt: 'Dumbbell Hammer Curl',
          sets: 3,
          reps: '10-12',
          rir: '0-1',
          rest: '60-90s'
        },
        {
          id: 'ex_pull_b_6',
          order: 6,
          stt: 6,
          isKey: false,
          keyLiftIndex: null,
          excelRow: null,
          name: 'Seated Biceps Curl Machine',
          machine: 'Máy cuốn tay trước ngồi (Biceps Curl Machine)',
          alt: 'Cable Curl thanh thẳng',
          sets: 3,
          reps: '10-12',
          rir: '0-1',
          rest: '60-90s'
        },
        {
          id: 'ex_pull_b_7',
          order: 7,
          stt: 7,
          isKey: false,
          keyLiftIndex: null,
          excelRow: null,
          name: '[Liên sườn] Cable Woodchopper / Torso Rotation',
          machine: 'Máy xoay eo (Torso Rotation) hoặc Máy kéo cáp chéo',
          alt: 'Pallof Press trên máy cáp',
          sets: 2,
          reps: '12-15/bên',
          rir: '1',
          rest: '60s'
        }
      ]
    },
    {
      id: 'legs_b',
      name: 'T7 - Legs B',
      shortName: 'Legs B',
      shortDay: 'T7',
      dayOfWeek: 6,
      dayLabel: 'Thứ Bảy',
      focus: 'Ưu tiên không bỏ buổi Chân vì InBody Chân đang 98.1% / 99.4% (<100%) — Trọng tâm Đùi sau, Mông & Bụng C',
      priorityNote: 'KHÔNG BỎ BUỔI NÀY — Hoàn tất 2 buổi Chân & siết múi bụng!',
      isRestDay: false,
      isBuiltIn: true,
      priorityLegs: true,
      color: '#f59e0b',
      exercises: [
        {
          id: 'ex_legs_b_1',
          order: 1,
          stt: 1,
          isKey: true,
          keyLiftIndex: 11,
          excelRow: 16,
          name: 'Smith Machine Romanian Deadlift (RDL)',
          machine: 'Máy khung Smith kéo đùi sau (Smith RDL)',
          alt: '45° Back Extension ôm tạ / Dumbbell RDL',
          sets: 3,
          reps: '8-10',
          rir: '1-2',
          rest: '2.5-3p'
        },
        {
          id: 'ex_legs_b_2',
          order: 2,
          stt: 2,
          isKey: false,
          keyLiftIndex: null,
          excelRow: null,
          name: 'Hip Thrust / Glute Drive Machine',
          machine: 'Máy đẩy hông mông (Glute Drive / Hip Thrust)',
          alt: 'Smith Machine Hip Thrust / Leg Press chân cao',
          sets: 3,
          reps: '10-12',
          rir: '1-2',
          rest: '2-2.5p'
        },
        {
          id: 'ex_legs_b_3',
          order: 3,
          stt: 3,
          isKey: false,
          keyLiftIndex: null,
          excelRow: null,
          name: 'Lying Leg Curl Machine',
          machine: 'Máy móc đùi sau nằm sấp (Lying Leg Curl)',
          alt: 'Seated Leg Curl Machine',
          sets: 3,
          reps: '10-12',
          rir: '0-1',
          rest: '90s'
        },
        {
          id: 'ex_legs_b_4',
          order: 4,
          stt: 4,
          isKey: false,
          keyLiftIndex: null,
          excelRow: null,
          name: 'Leg Extension Machine',
          machine: 'Máy đá đùi trước ngồi (Leg Extension Machine)',
          alt: 'Smith Machine Bulgarian Split Squat',
          sets: 3,
          reps: '12-15',
          rir: '0-1',
          rest: '90s'
        },
        {
          id: 'ex_legs_b_5',
          order: 5,
          stt: 5,
          isKey: false,
          keyLiftIndex: null,
          excelRow: null,
          name: 'Hip Abductor Machine',
          machine: 'Máy mở đùi ngoài (Seated Hip Abduction)',
          alt: 'Cable Glute Kickback',
          sets: 2,
          reps: '12-15',
          rir: '0-1',
          rest: '60-90s'
        },
        {
          id: 'ex_legs_b_6',
          order: 6,
          stt: 6,
          isKey: false,
          keyLiftIndex: null,
          excelRow: null,
          name: 'Seated Calf Raise Machine',
          machine: 'Máy nhón bắp chân ngồi (Seated Calf Raise)',
          alt: 'Standing Calf Raise Machine',
          sets: 4,
          reps: '12-15',
          rir: '0-1',
          rest: '60-90s'
        },
        {
          id: 'ex_legs_b_7',
          order: 7,
          stt: 7,
          isKey: true,
          keyLiftIndex: 12,
          excelRow: 17,
          name: '[Bụng C] Seated Ab Crunch Machine',
          machine: 'Máy gập bụng ngồi có tạ (Ab Crunch Machine)',
          alt: 'Weighted Cable Crunch',
          sets: 3,
          reps: '12-15',
          rir: '0-1',
          rest: '60-90s'
        }
      ]
    },
    {
      id: 'rest_sunday',
      name: 'CN - Nghỉ & Phục Hồi',
      shortName: 'Nghỉ CN',
      shortDay: 'CN',
      dayOfWeek: 0,
      dayLabel: 'Chủ Nhật',
      focus: 'Nghỉ tập tạ hoàn toàn · Đi bộ 8.000+ bước · Giãn cơ nhẹ 10p · Cắt nửa chén cơm tối · Review tuần 3 phút',
      priorityNote: 'Phục hồi hệ thần kinh & hoàn thành Review sáng Chủ Nhật',
      isRestDay: true,
      isBuiltIn: true,
      priorityLegs: false,
      color: '#64748b',
      exercises: [
        {
          id: 'ex_rest_sun_1',
          order: 1,
          stt: 1,
          isKey: false,
          keyLiftIndex: null,
          excelRow: null,
          name: 'Đi bộ thư giãn 8.000+ bước',
          machine: 'Ngoài trời / Máy đi bộ nhẹ',
          alt: 'Đạp xe nhẹ thư giãn 30 phút',
          sets: 0,
          reps: '30-45p',
          rir: '',
          rest: '-'
        },
        {
          id: 'ex_rest_sun_2',
          order: 2,
          stt: 2,
          isKey: false,
          keyLiftIndex: null,
          excelRow: null,
          name: 'Giãn cơ nhẹ toàn thân 10 phút',
          machine: 'Thảm tập / Foam Roller',
          alt: 'Giãn khớp vai, hông & gân kheo',
          sets: 0,
          reps: '10p',
          rir: '',
          rest: '-'
        },
        {
          id: 'ex_rest_sun_3',
          order: 3,
          stt: 3,
          isKey: false,
          keyLiftIndex: null,
          excelRow: null,
          name: 'Review sáng Chủ Nhật (3 phút: Cân nặng, Vòng eo & Log tạ ★)',
          machine: 'Tab Nhóm tập -> Review & Log Tạ ★',
          alt: 'Cắt bớt nửa chén cơm bữa tối ngày nghỉ',
          sets: 0,
          reps: '3p',
          rir: '',
          rest: '-'
        }
      ]
    }
  ];

  // Verbatim 12 ★ key lifts from Sheet 3_Log_Ta_12_Bai_Chinh (rows 6..17)
  const KEY_LIFTS_12 = [
    {
      keyLiftIndex: 1,
      excelRow: 6,
      exerciseId: 'ex_push_a_1',
      altExerciseId: 'push_a_1',
      groupId: 'push_a',
      session: 'T2 - Push A',
      name: 'Incline Chest Press Machine',
      machine: 'Máy đẩy ngực trên ngồi',
      target: '3 x 8-10'
    },
    {
      keyLiftIndex: 2,
      excelRow: 7,
      exerciseId: 'ex_push_a_4',
      altExerciseId: 'push_a_4',
      groupId: 'push_a',
      session: 'T2 - Push A',
      name: 'Machine Lateral Raise',
      machine: 'Máy dang vai ngang ngồi',
      target: '4 x 12-15'
    },
    {
      keyLiftIndex: 3,
      excelRow: 8,
      exerciseId: 'ex_pull_a_1',
      altExerciseId: 'pull_a_1',
      groupId: 'pull_a',
      session: 'T3 - Pull A',
      name: 'Lat Pulldown Machine (Mid/Neutral Grip)',
      machine: 'Máy kéo xô trên',
      target: '3 x 8-12'
    },
    {
      keyLiftIndex: 4,
      excelRow: 9,
      exerciseId: 'ex_pull_a_7',
      altExerciseId: 'pull_a_7',
      groupId: 'pull_a',
      session: 'T3 - Pull A',
      name: 'Weighted Cable Crunch (Abs A)',
      machine: 'Máy cáp cao + dây thừng (Bụng)',
      target: '3 x 12-15'
    },
    {
      keyLiftIndex: 5,
      excelRow: 10,
      exerciseId: 'ex_legs_a_1',
      altExerciseId: 'legs_a_1',
      groupId: 'legs_a',
      session: 'T4 - Legs A',
      name: 'Hack Squat Machine',
      machine: 'Máy Squat trượt nghiêng 45°',
      target: '3 x 8-10'
    },
    {
      keyLiftIndex: 6,
      excelRow: 11,
      exerciseId: 'ex_legs_a_3',
      altExerciseId: 'legs_a_3',
      groupId: 'legs_a',
      session: 'T4 - Legs A',
      name: 'Seated Leg Curl Machine',
      machine: 'Máy móc đùi sau ngồi',
      target: '3 x 10-12'
    },
    {
      keyLiftIndex: 7,
      excelRow: 12,
      exerciseId: 'ex_push_b_1',
      altExerciseId: 'push_b_1',
      groupId: 'push_b',
      session: 'T5 - Push B',
      name: 'Seated Shoulder Press Machine',
      machine: 'Máy đẩy vai ngồi',
      target: '3 x 8-10'
    },
    {
      keyLiftIndex: 8,
      excelRow: 13,
      exerciseId: 'ex_push_b_2',
      altExerciseId: 'push_b_2',
      groupId: 'push_b',
      session: 'T5 - Push B',
      name: 'Smith Machine Incline Press (30°)',
      machine: 'Máy khung Smith ghế 30°',
      target: '3 x 8-12'
    },
    {
      keyLiftIndex: 9,
      excelRow: 14,
      exerciseId: 'ex_pull_b_1',
      altExerciseId: 'pull_b_1',
      groupId: 'pull_b',
      session: 'T6 - Pull B',
      name: 'Seated Cable Row (Neutral Narrow)',
      machine: 'Máy kéo cáp ngồi tay hẹp',
      target: '3 x 8-12'
    },
    {
      keyLiftIndex: 10,
      excelRow: 15,
      exerciseId: 'ex_pull_b_2',
      altExerciseId: 'pull_b_2',
      groupId: 'pull_b',
      session: 'T6 - Pull B',
      name: 'Assisted Pull-Up Machine',
      machine: 'Máy kéo xà trợ lực',
      target: '3 x 8-10'
    },
    {
      keyLiftIndex: 11,
      excelRow: 16,
      exerciseId: 'ex_legs_b_1',
      altExerciseId: 'legs_b_1',
      groupId: 'legs_b',
      session: 'T7 - Legs B',
      name: 'Smith Machine Romanian Deadlift (RDL)',
      machine: 'Máy khung Smith kéo đùi sau',
      target: '3 x 8-10'
    },
    {
      keyLiftIndex: 12,
      excelRow: 17,
      exerciseId: 'ex_legs_b_7',
      altExerciseId: 'legs_b_7',
      groupId: 'legs_b',
      session: 'T7 - Legs B',
      name: 'Seated Ab Crunch Machine (Abs C)',
      machine: 'Máy gập bụng ngồi có tạ',
      target: '3 x 12-15'
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
  function getExerciseIdAliases(exId) {
    if (!exId || typeof exId !== 'string') return [];
    const trimmed = exId.trim();
    if (!trimmed) return [];
    const list = [trimmed];
    if (trimmed.startsWith('ex_')) {
      list.push(trimmed.slice(3));
    } else if (/^(push_a|pull_a|legs_a|push_b|pull_b|legs_b|rest_sun)_\d+$/.test(trimmed)) {
      list.push('ex_' + trimmed);
    }
    return list;
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

  function cloneWorkoutGroup(group, fallbackIndex) {
    const exercises = Array.isArray(group?.exercises)
      ? group.exercises.map((ex, idx) => cloneExercise(ex, idx + 1)).filter((ex) => ex.name)
      : [];
    return {
      id: String(group?.id || `custom_group_${(fallbackIndex || 0) + 1}`),
      name: String(group?.name || 'Nhóm tập mới').trim(),
      shortName: String(group?.shortName || group?.shortDay || group?.name || 'Nhóm tập').trim(),
      shortDay: String(group?.shortDay || '').trim(),
      dayOfWeek:
        group?.dayOfWeek === null || group?.dayOfWeek === undefined || group?.dayOfWeek === ''
          ? null
          : Number(group.dayOfWeek),
      dayLabel: String(group?.dayLabel || '').trim(),
      focus: String(group?.focus || group?.subtitle || '').trim(),
      priorityNote: String(group?.priorityNote || '').trim(),
      isRestDay: Boolean(group?.isRestDay || group?.isRest),
      isBuiltIn: Boolean(group?.isBuiltIn || group?.isDefault),
      priorityLegs: Boolean(group?.priorityLegs),
      color: String(group?.color || '#10b981'),
      updatedAt: Number(group?.updatedAt) || 0,
      exercises
    };
  }

  // ==========================================
  // DEFAULT STATE & SAFE NORMALIZATION
  // ==========================================
  function getDefaultGymData() {
    return {
      version: 1,
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

    // Workout groups
    let workoutGroups = defaults.workoutGroups;
    if (Array.isArray(raw.workoutGroups) && raw.workoutGroups.length > 0) {
      const seenIds = new Set();
      const cleaned = [];
      raw.workoutGroups.forEach((g, idx) => {
        if (!g || typeof g !== 'object') return;
        const cloned = cloneWorkoutGroup(g, idx);
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
      version: Number(raw.version) || 1,
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
        mergedDailyLogs[d] = {
          ...loser,
          ...winner,
          habits: { ...(loser.habits || {}), ...(winner.habits || {}) },
          weights: { ...(loser.weights || {}), ...(winner.weights || {}) },
          completedExercises: { ...(loser.completedExercises || {}), ...(winner.completedExercises || {}) },
          exerciseDone: { ...(loser.completedExercises || {}), ...(winner.completedExercises || {}) },
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

    return normalizeGymData({
      version: Math.max(local.version, remote.version),
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
  const DAY_OF_WEEK_GROUP_MAP = {
    1: 'push_a',
    2: 'pull_a',
    3: 'legs_a',
    4: 'push_b',
    5: 'pull_b',
    6: 'legs_b',
    0: 'rest_sunday'
  };

  function getSuggestedGroupForDate(dateStr, workoutGroups) {
    const groups = Array.isArray(workoutGroups) && workoutGroups.length > 0
      ? workoutGroups
      : DEFAULT_WORKOUT_GROUPS;
    const d = parseIsoDate(dateStr) || new Date();
    const dow = d.getDay();
    const preferredId = DAY_OF_WEEK_GROUP_MAP[dow];

    return (
      groups.find((g) => g.id === preferredId) ||
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
    const aliases = new Set(getExerciseIdAliases(exerciseId));

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

    const exerciseTotalCount = exerciseTasks.length;
    const exerciseDoneCount = exerciseTasks.filter((t) => Boolean(t.completed)).length;

    const firstExercise = exerciseTasks[0] || null;
    const workoutGroupId = firstExercise?.gymGroupId || dailyLog?.workoutGroupId || dailyLog?.groupId || null;
    const matchedGroup = workoutGroupId
      ? normalized.workoutGroups.find((g) => g.id === workoutGroupId) || null
      : null;
    const workoutGroupName =
      firstExercise?.gymGroupName || dailyLog?.workoutGroupName || dailyLog?.groupName || matchedGroup?.name || '';
    const isRestGroup = Boolean(matchedGroup?.isRestDay || workoutGroupId === 'rest_sunday');

    const dObj = parseIsoDate(targetDate);
    const isSunday = dObj ? dObj.getDay() === 0 : false;

    const completedMajorityExercises =
      !isRestGroup &&
      exerciseTotalCount > 0 &&
      exerciseDoneCount >= Math.max(1, Math.ceil(exerciseTotalCount * 0.5));

    const workoutDone = isSunday
      ? completedMajorityExercises
      : Boolean(habitsMap.habit_workout || completedMajorityExercises);

    const cleanEating = Boolean(
      habitsMap.habit_protein && habitsMap.habit_carbs && habitsMap.habit_no_liquid_cal
    );
    const stepsSleep = Boolean(habitsMap.habit_steps_water && habitsMap.habit_sleep);

    const hasLogActivity = Boolean(
      dailyLog &&
        (Object.values(dailyLog.habits || {}).some(Boolean) ||
          Object.keys(dailyLog.weights || {}).length > 0 ||
          dailyLog.workoutGroupId ||
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
    } else if (hasHabitTasks || (hasLogActivity && targetDate && targetDate < getTodayDateStr())) {
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
      workoutGroupId,
      workoutGroupName,
      hasHabitTasks,
      hasActivity: Boolean(hasHabitTasks || exerciseTotalCount > 0 || hasLogActivity)
    };
  }

  // ==========================================
  // WEEKLY ADVICE FORMULA (MATCHES EXCEL SHEET 1)
  // ==========================================
  function computeWeeklyAdvice({ weekNum, hasActivity, sessionsCount, cleanEatingDays, waistDelta, strengthTrend }) {
    if (!hasActivity) {
      return {
        text: 'Chưa có dữ liệu tuần này — Tick 6 thói quen hàng ngày & check-in 30 giây sáng Chủ Nhật.',
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
    if (
      (sessionsCount !== null && sessionsCount < 4) ||
      (cleanEatingDays !== null && cleanEatingDays < 5)
    ) {
      return {
        text: 'Ưu tiên giữ đều >=5 buổi/tuần & 5/7 ngày ăn chuẩn trước',
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
    const { baseline, planStartSunday, weeklyCheckins, dailyLogs, workoutGroups } = normalized;
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
        getExerciseIdAliases(exId).forEach((aid) => {
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

      const cappedAutoSessions = Math.min(6, autoSessionsCount);
      const sessionsCount =
        checkin.sessionsOverride !== null && checkin.sessionsOverride !== undefined
          ? Math.min(6, Math.max(0, Number(checkin.sessionsOverride)))
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
          checkin.sessionsOverride !== null
      );
      const hasActivity = Boolean(weekHasDailyActivity || hasCheckinInput);

      const adviceObj = computeWeeklyAdvice({
        weekNum,
        hasActivity,
        sessionsCount: hasActivity ? sessionsCount : null,
        cleanEatingDays: hasActivity ? cleanEatingDays : null,
        waistDelta,
        strengthTrend
      });

      weeks.push({
        weekNum,
        code: weekNum === 9 ? 'T9 - Deload' : `T${weekNum}`,
        shortCode: `T${weekNum}`,
        isDeload: weekNum === 9,
        mondayDate,
        sundayDate,
        dates,
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
      reviewedWeeks > 0 ? Math.round((totalSessions / (reviewedWeeks * 6)) * 100) : 0;
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
          keyLiftsLogged,
          allWeightsLogged,
          note: log?.note || ''
        };
      });

    return {
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
    const { baseline, weeks, totals, keyLiftsSummary } = analytics;
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
        sessions: wk.hasActivity ? `${wk.sessionsCount}/6` : '',
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
        { id: 'sessions', name: 'Buổi tập (/6)', width: 115, type: 'text' },
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
      existingOnDate.filter((t) => t.completed && t.gymExerciseId).map((t) => t.gymExerciseId)
    );
    const existingLogWeights = gymData?.dailyLogs?.[targetDate]?.weights || {};

    const now = Date.now();
    const tasksToAdd = [];

    group.exercises.forEach((ex, idx) => {
      if (!ex || !ex.name) return;
      if (ex.id && completedExerciseIds.has(ex.id)) return;

      const setsNum = Number(ex.sets) || 0;
      const setsReps = setsNum > 0 ? `${setsNum} × ${ex.reps || '10-12'}` : ex.reps || '';
      const rirPart = ex.rir ? ` · RIR ${ex.rir}` : '';
      const restPart = ex.rest && ex.rest !== '-' ? ` · Nghỉ ${ex.rest}` : '';
      const prevWeight = gymData ? getLatestExerciseWeight(gymData, safeTasks, ex.id, targetDate) : null;
      const loggedTodayWeight = parsePositiveWeight(existingLogWeights[ex.id]);

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
        completed: false,
        completedAt: null,
        createdAt: now + idx,
        updatedAt: now + idx,
        gymType: 'exercise',
        gymGroupId: group.id,
        gymGroupName: group.name,
        gymExerciseId: ex.id || `${group.id}_ex_${idx + 1}`,
        gymIsKey: Boolean(ex.isKey),
        gymKeyLiftIndex: ex.keyLiftIndex || null,
        gymMachine: ex.machine || '',
        gymAlt: ex.alt || '',
        gymSets: setsNum,
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
    DEFAULT_BASELINE,
    DAILY_HABITS_TEMPLATE,
    DEFAULT_WORKOUT_GROUPS,
    KEY_LIFTS_12,
    STRENGTH_TREND_OPTIONS,
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
