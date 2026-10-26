import type { MuscleGroup } from './types';

/** Equipment the room scan can detect. Ids are also the enum given to the AI. */
export const EQUIPMENT: Record<string, string> = {
  dumbbells: 'Kurzhanteln',
  barbell: 'Langhantel',
  ez_bar: 'SZ-Stange',
  weight_plates: 'Hantelscheiben',
  kettlebell: 'Kettlebell',
  bench: 'Hantelbank',
  incline_bench: 'Schrägbank (verstellbar)',
  squat_rack: 'Power Rack / Kniebeugenständer',
  smith_machine: 'Multipresse',
  pullup_bar: 'Klimmzugstange',
  dip_station: 'Dip-Station / Barren',
  cable_machine: 'Kabelzug',
  lat_pulldown: 'Latzug',
  seated_row: 'Rudermaschine sitzend',
  chest_press: 'Brustpresse',
  pec_deck: 'Butterfly-Maschine',
  shoulder_press_machine: 'Schulterpresse',
  leg_press: 'Beinpresse',
  hack_squat: 'Hackenschmidt-Maschine',
  leg_extension: 'Beinstrecker',
  leg_curl: 'Beinbeuger-Maschine',
  calf_machine: 'Wadenmaschine',
  hip_abductor: 'Abduktoren-/Adduktoren-Maschine',
  back_extension: 'Hyperextension-Bank',
  ab_wheel: 'Bauchroller',
  resistance_bands: 'Widerstandsbänder',
  trx: 'Schlingentrainer (TRX)',
  medicine_ball: 'Medizinball',
  plyo_box: 'Plyo-Box / Step',
  mat: 'Trainingsmatte',
  foam_roller: 'Faszienrolle',
  battle_ropes: 'Battle Ropes',
  jump_rope: 'Springseil',
  treadmill: 'Laufband',
  bike: 'Ergometer / Spinning-Bike',
  rower: 'Rudergerät',
  elliptical: 'Crosstrainer',
  stair_climber: 'Stepper / Treppensteiger',
};

export const EQUIPMENT_IDS = Object.keys(EQUIPMENT);

export const MUSCLE_LABEL: Record<MuscleGroup, string> = {
  brust: 'Brust',
  ruecken: 'Rücken',
  schultern: 'Schultern',
  bizeps: 'Bizeps',
  trizeps: 'Trizeps',
  beine: 'Beine (Quadrizeps)',
  po: 'Po',
  beinbeuger: 'Beinbeuger',
  waden: 'Waden',
  core: 'Bauch & Rumpf',
  cardio: 'Ausdauer',
};

export type ExerciseType = 'compound' | 'isolation' | 'cardio';

export interface Exercise {
  id: string;
  name: string;
  /** First entry is the main target. */
  muscles: MuscleGroup[];
  /** Each entry must be available; an inner array means "one of these". Empty = Körpergewicht. */
  needs: (string | string[])[];
  type: ExerciseType;
  cue: string;
}

const ex = (
  id: string,
  name: string,
  muscles: MuscleGroup[],
  needs: (string | string[])[],
  type: ExerciseType,
  cue: string,
): Exercise => ({ id, name, muscles, needs, type, cue });

export const EXERCISES: Exercise[] = [
  // Brust
  ex('bankdruecken', 'Bankdrücken (Langhantel)', ['brust', 'trizeps', 'schultern'], ['barbell', 'bench'], 'compound', 'Schulterblätter zusammen, Stange zur unteren Brust.'),
  ex('kh_bankdruecken', 'Kurzhantel-Bankdrücken', ['brust', 'trizeps', 'schultern'], ['dumbbells', ['bench', 'incline_bench']], 'compound', 'Ellbogen ca. 45° vom Körper, kontrolliert absenken.'),
  ex('schraegbank_kh', 'Schrägbankdrücken (Kurzhanteln)', ['brust', 'schultern', 'trizeps'], ['dumbbells', 'incline_bench'], 'compound', 'Bank auf 30°, Fokus obere Brust.'),
  ex('schraegbank_lh', 'Schrägbankdrücken (Langhantel)', ['brust', 'schultern', 'trizeps'], ['barbell', 'incline_bench'], 'compound', 'Bank auf 30°, Stange zum oberen Brustbein.'),
  ex('multipresse_bank', 'Bankdrücken an der Multipresse', ['brust', 'trizeps'], ['smith_machine', ['bench', 'incline_bench']], 'compound', 'Bank so ausrichten, dass die Stange über der Brust landet.'),
  ex('brustpresse', 'Brustpresse (Maschine)', ['brust', 'trizeps'], ['chest_press'], 'compound', 'Griffe auf Brusthöhe, nicht ganz durchstrecken.'),
  ex('dips', 'Dips', ['brust', 'trizeps', 'schultern'], ['dip_station'], 'compound', 'Leicht nach vorne lehnen für mehr Brust.'),
  ex('liegestuetze', 'Liegestütze', ['brust', 'trizeps', 'schultern'], [], 'compound', 'Körper wie ein Brett, Brust fast bis zum Boden.'),
  ex('kh_flys', 'Kurzhantel-Flys', ['brust'], ['dumbbells', ['bench', 'incline_bench']], 'isolation', 'Leicht gebeugte Arme, Dehnung spüren.'),
  ex('butterfly', 'Butterfly-Maschine', ['brust'], ['pec_deck'], 'isolation', 'Kurz halten, wenn die Griffe sich treffen.'),
  ex('kabel_crossover', 'Kabel-Crossover', ['brust'], ['cable_machine'], 'isolation', 'Von oben nach unten ziehen, Hände vor dem Bauch zusammen.'),
  ex('band_brustpresse', 'Brustpresse mit Band', ['brust', 'trizeps'], ['resistance_bands'], 'isolation', 'Band hinter dem Rücken, nach vorne drücken.'),
  // Rücken
  ex('klimmzuege', 'Klimmzüge', ['ruecken', 'bizeps'], ['pullup_bar'], 'compound', 'Brust zur Stange, langsam ablassen. Notfalls mit Band.'),
  ex('latzug', 'Latzug', ['ruecken', 'bizeps'], ['lat_pulldown'], 'compound', 'Stange zur oberen Brust, Ellbogen nach unten führen.'),
  ex('lh_rudern', 'Langhantelrudern', ['ruecken', 'bizeps'], ['barbell'], 'compound', 'Oberkörper ~45° vorgebeugt, Rücken gerade.'),
  ex('kh_rudern', 'Einarmiges Kurzhantelrudern', ['ruecken', 'bizeps'], ['dumbbells'], 'compound', 'Hantel zur Hüfte ziehen, nicht reißen.'),
  ex('kabelrudern', 'Kabelrudern sitzend', ['ruecken', 'bizeps'], [['seated_row', 'cable_machine']], 'compound', 'Schulterblätter zuerst zusammenziehen.'),
  ex('kreuzheben', 'Kreuzheben', ['ruecken', 'beinbeuger', 'po'], ['barbell'], 'compound', 'Stange nah am Körper, neutraler Rücken.'),
  ex('trx_rudern', 'TRX-Rudern', ['ruecken', 'bizeps'], ['trx'], 'compound', 'Je flacher der Körper, desto schwerer.'),
  ex('band_rudern', 'Rudern mit Band', ['ruecken', 'bizeps'], ['resistance_bands'], 'isolation', 'Band um einen festen Punkt, Ellbogen eng.'),
  ex('hyperextension', 'Hyperextensions', ['ruecken', 'po'], ['back_extension'], 'isolation', 'Nur bis zur Geraden hochkommen, nicht überstrecken.'),
  ex('face_pulls', 'Face Pulls', ['schultern', 'ruecken'], [['cable_machine', 'resistance_bands']], 'isolation', 'Seil zur Stirn, Ellbogen hoch.'),
  ex('superman', 'Superman', ['ruecken', 'core'], [], 'isolation', 'Arme und Beine gleichzeitig anheben, 2 s halten.'),
  // Schultern
  ex('schulterdruecken_kh', 'Schulterdrücken (Kurzhanteln)', ['schultern', 'trizeps'], ['dumbbells'], 'compound', 'Bauch fest, nicht ins Hohlkreuz fallen.'),
  ex('military_press', 'Military Press (Langhantel)', ['schultern', 'trizeps'], ['barbell'], 'compound', 'Stehend, Po und Bauch anspannen.'),
  ex('schulterpresse', 'Schulterpresse (Maschine)', ['schultern', 'trizeps'], ['shoulder_press_machine'], 'compound', 'Griffe auf Kinnhöhe starten.'),
  ex('pike_pushups', 'Pike Push-ups', ['schultern', 'trizeps'], [], 'compound', 'Hüfte hoch, Kopf zwischen die Hände senken.'),
  ex('seitheben', 'Seitheben', ['schultern'], ['dumbbells'], 'isolation', 'Bis Schulterhöhe, kleine Finger leicht oben.'),
  ex('seitheben_kabel', 'Seitheben am Kabel', ['schultern'], ['cable_machine'], 'isolation', 'Konstante Spannung, langsam zurück.'),
  ex('band_seitheben', 'Seitheben mit Band', ['schultern'], ['resistance_bands'], 'isolation', 'Auf das Band stellen, seitlich anheben.'),
  ex('frontheben', 'Frontheben', ['schultern'], [['dumbbells', 'weight_plates']], 'isolation', 'Bis Augenhöhe, ohne Schwung.'),
  ex('reverse_flys', 'Reverse Flys', ['schultern', 'ruecken'], [['dumbbells', 'pec_deck']], 'isolation', 'Hintere Schulter: Arme seitlich nach hinten öffnen.'),
  // Bizeps
  ex('chin_ups', 'Chin-ups (Untergriff)', ['bizeps', 'ruecken'], ['pullup_bar'], 'compound', 'Untergriff schulterbreit, Kinn über die Stange.'),
  ex('kh_curls', 'Kurzhantel-Curls', ['bizeps'], ['dumbbells'], 'isolation', 'Ellbogen am Körper, Handgelenk drehen.'),
  ex('sz_curls', 'SZ-Curls', ['bizeps'], ['ez_bar'], 'isolation', 'Ohne Schwung aus dem Rücken.'),
  ex('lh_curls', 'Langhantel-Curls', ['bizeps'], ['barbell'], 'isolation', 'Schulterbreit greifen, oben anspannen.'),
  ex('hammer_curls', 'Hammer-Curls', ['bizeps'], ['dumbbells'], 'isolation', 'Daumen zeigen nach oben.'),
  ex('kabel_curls', 'Kabel-Curls', ['bizeps'], ['cable_machine'], 'isolation', 'Ständige Spannung, unten ganz strecken.'),
  ex('band_curls', 'Curls mit Band', ['bizeps'], ['resistance_bands'], 'isolation', 'Langsam ablassen.'),
  // Trizeps
  ex('trizeps_kabel', 'Trizepsdrücken am Kabel', ['trizeps'], ['cable_machine'], 'isolation', 'Ellbogen fixiert, unten voll strecken.'),
  ex('french_press', 'French Press', ['trizeps'], [['ez_bar', 'barbell', 'dumbbells'], ['bench', 'incline_bench']], 'isolation', 'Gewicht Richtung Stirn senken, Oberarme ruhig.'),
  ex('overhead_trizeps', 'Überkopf-Trizepsstrecken', ['trizeps'], ['dumbbells'], 'isolation', 'Ellbogen zeigen nach vorne-oben.'),
  ex('kickbacks', 'Trizeps-Kickbacks', ['trizeps'], ['dumbbells'], 'isolation', 'Oberarm parallel zum Boden halten.'),
  ex('bank_dips', 'Bank-Dips', ['trizeps', 'brust'], [['bench', 'incline_bench', 'plyo_box']], 'compound', 'Hände hinter dir auf der Bank, Po nah dran.'),
  ex('enge_liegestuetze', 'Enge Liegestütze', ['trizeps', 'brust'], [], 'compound', 'Hände unter den Schultern, Ellbogen am Körper.'),
  ex('band_trizeps', 'Trizepsdrücken mit Band', ['trizeps'], ['resistance_bands'], 'isolation', 'Band oben fixieren, nach unten drücken.'),
  // Beine
  ex('kniebeuge', 'Kniebeugen (Langhantel)', ['beine', 'po', 'beinbeuger'], ['barbell', 'squat_rack'], 'compound', 'Mindestens bis parallel, Knie über die Zehen.'),
  ex('multipresse_kniebeuge', 'Kniebeugen an der Multipresse', ['beine', 'po'], ['smith_machine'], 'compound', 'Füße etwas vor dem Körper.'),
  ex('goblet_squat', 'Goblet Squats', ['beine', 'po'], [['dumbbells', 'kettlebell']], 'compound', 'Gewicht vor der Brust, aufrechter Oberkörper.'),
  ex('beinpresse', 'Beinpresse', ['beine', 'po'], ['leg_press'], 'compound', 'Knie nicht ganz durchdrücken.'),
  ex('hackenschmidt', 'Hackenschmidt-Kniebeugen', ['beine', 'po'], ['hack_squat'], 'compound', 'Tief und kontrolliert.'),
  ex('ausfallschritte', 'Ausfallschritte (Kurzhanteln)', ['beine', 'po'], ['dumbbells'], 'compound', 'Hinteres Knie fast bis zum Boden.'),
  ex('bulgarian', 'Bulgarian Split Squats', ['beine', 'po'], [['bench', 'incline_bench', 'plyo_box']], 'compound', 'Hinterer Fuß auf der Bank, vorderes Bein arbeitet.'),
  ex('step_ups', 'Step-ups', ['beine', 'po'], [['plyo_box', 'bench']], 'compound', 'Über die Ferse hochdrücken.'),
  ex('kniebeuge_bw', 'Kniebeugen (Körpergewicht)', ['beine', 'po'], [], 'compound', 'Langsam runter (3 s), explosiv hoch.'),
  ex('box_jumps', 'Box Jumps', ['beine', 'cardio'], ['plyo_box'], 'compound', 'Weich landen, runter steigen statt springen.'),
  ex('beinstrecker', 'Beinstrecker', ['beine'], ['leg_extension'], 'isolation', 'Oben 1 s halten.'),
  ex('wandsitzen', 'Wandsitzen', ['beine'], [], 'isolation', 'Knie im 90°-Winkel, 45–60 s halten.'),
  // Beinbeuger & Po
  ex('beinbeuger', 'Beinbeuger (Maschine)', ['beinbeuger'], ['leg_curl'], 'isolation', 'Langsam ablassen.'),
  ex('rdl_kh', 'Rumänisches Kreuzheben (Kurzhanteln)', ['beinbeuger', 'po', 'ruecken'], ['dumbbells'], 'compound', 'Hüfte nach hinten schieben, Dehnung hinten am Bein.'),
  ex('kb_swing', 'Kettlebell Swings', ['po', 'beinbeuger', 'core'], ['kettlebell'], 'compound', 'Explosiv aus der Hüfte, nicht aus den Armen.'),
  ex('hip_thrust', 'Hip Thrusts (Langhantel)', ['po', 'beinbeuger'], ['barbell', ['bench', 'incline_bench']], 'compound', 'Oben Po fest anspannen, Kinn zur Brust.'),
  ex('glute_bridge', 'Glute Bridge', ['po', 'beinbeuger'], [], 'isolation', 'Hüfte hoch, 2 s halten.'),
  ex('abduktoren', 'Abduktoren-Maschine', ['po'], ['hip_abductor'], 'isolation', 'Leicht nach vorne lehnen.'),
  ex('kabel_kickbacks', 'Kabel-Kickbacks (Po)', ['po'], ['cable_machine'], 'isolation', 'Bein gestreckt nach hinten führen.'),
  ex('monster_walks', 'Monster Walks mit Band', ['po'], ['resistance_bands'], 'isolation', 'Band über den Knien, seitlich gehen.'),
  // Waden
  ex('wadenmaschine', 'Wadenheben (Maschine)', ['waden'], ['calf_machine'], 'isolation', 'Ganz hoch, ganz runter.'),
  ex('waden_beinpresse', 'Wadendrücken an der Beinpresse', ['waden'], ['leg_press'], 'isolation', 'Nur die Fußballen auf der Platte.'),
  ex('wadenheben', 'Wadenheben stehend', ['waden'], [], 'isolation', 'Auf einer Stufe für mehr Bewegungsumfang.'),
  // Core
  ex('plank', 'Plank', ['core'], [], 'isolation', 'Po anspannen, 30–60 s halten.'),
  ex('seitstuetz', 'Seitstütz', ['core'], [], 'isolation', 'Hüfte oben halten, 30 s pro Seite.'),
  ex('crunches', 'Crunches', ['core'], [], 'isolation', 'Nur Schulterblätter abheben.'),
  ex('dead_bug', 'Dead Bug', ['core'], [], 'isolation', 'Unterer Rücken bleibt am Boden.'),
  ex('beinheben', 'Hängendes Beinheben', ['core'], ['pullup_bar'], 'isolation', 'Ohne Schwung, Becken einrollen.'),
  ex('kabel_crunch', 'Kabel-Crunches', ['core'], ['cable_machine'], 'isolation', 'Kniend, Ellbogen Richtung Knie.'),
  ex('russian_twist', 'Russian Twists', ['core'], [['medicine_ball', 'dumbbells', 'kettlebell', 'weight_plates']], 'isolation', 'Füße anheben für mehr Schwierigkeit.'),
  ex('ab_wheel', 'Ab-Wheel Rollouts', ['core'], ['ab_wheel'], 'isolation', 'Nur so weit, wie der Rücken gerade bleibt.'),
  ex('pallof', 'Pallof Press', ['core'], [['cable_machine', 'resistance_bands']], 'isolation', 'Gegen die Rotation stabilisieren.'),
  ex('mountain_climbers', 'Mountain Climbers', ['core', 'cardio'], [], 'isolation', 'Zügig, Hüfte unten halten.'),
  // Ausdauer
  ex('laufband', 'Laufband-Intervalle', ['cardio'], ['treadmill'], 'cardio', '1 min schnell / 1 min locker.'),
  ex('ergometer', 'Ergometer-Intervalle', ['cardio', 'beine'], ['bike'], 'cardio', '30 s Sprint / 90 s locker.'),
  ex('rudergeraet', 'Rudergerät', ['cardio', 'ruecken'], ['rower'], 'cardio', 'Beine – Rücken – Arme, gleichmäßiger Zug.'),
  ex('crosstrainer', 'Crosstrainer', ['cardio'], ['elliptical'], 'cardio', 'Gleichmäßiges Tempo, Arme mitnehmen.'),
  ex('stepper', 'Stepper', ['cardio', 'beine'], ['stair_climber'], 'cardio', 'Aufrecht, nicht auf den Griffen abstützen.'),
  ex('seilspringen', 'Seilspringen', ['cardio', 'waden'], ['jump_rope'], 'cardio', '45 s springen / 15 s Pause.'),
  ex('battle_ropes', 'Battle Ropes', ['cardio', 'schultern'], ['battle_ropes'], 'cardio', '20 s Vollgas / 40 s Pause.'),
  ex('ball_slams', 'Medizinball-Slams', ['cardio', 'core'], ['medicine_ball'], 'cardio', 'Ball kraftvoll auf den Boden werfen.'),
  ex('burpees', 'Burpees', ['cardio', 'beine', 'brust'], [], 'cardio', 'Saubere Ausführung vor Tempo.'),
  ex('hampelmann', 'Hampelmänner', ['cardio'], [], 'cardio', 'Locker zum Aufwärmen.'),
];

export function isAvailable(exercise: Exercise, equipment: Set<string>): boolean {
  return exercise.needs.every((need) =>
    Array.isArray(need) ? need.some((n) => equipment.has(n)) : equipment.has(need),
  );
}

export function availableExercises(equipment: string[]): Exercise[] {
  const set = new Set(equipment);
  return EXERCISES.filter((e) => isAvailable(e, set));
}

export function equipmentLabel(id: string): string {
  return EQUIPMENT[id] ?? id;
}
