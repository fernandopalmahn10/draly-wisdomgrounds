// =========================================================================
// cartoon-codes.js · fun teacher codes for /maestro → Teachers → 🎲 «Sugerir» (his ask 2026-10-19: "I don't know about
// the names, send suggestions super cartoon style").
//
// A suggestion = an animal + a word that describes it + a food or a thing + 2 digits, joined by dashes, in capitals:
// three plain Spanish words a teacher can read aloud and type, the same idea as the key screen's example but longer.
// The words are curated for a kids' school in many Spanish-speaking countries: no ñ or ü (a code keeps only A-Z, 0-9
// and dashes), and nothing that is an insult, a joke about bodies, a drug, a brand or a double meaning anywhere
// (left out on purpose, among others: burro, vaca, cerdo, foca, ballena, rata, mono, gorila, zorra, loba, tigresa,
// pato, perico, grifo, camello, mariposa, mariquita, tortuga, rápido/a, travieso/a, atrevido/a, aventurero/a,
// goloso/a, peludo/a, cereza, papaya, chile, nieve, bombón, maraca, corona, globo, pelota; the numbers 69 and 88).
// Adjectives agree with the animal (LEONA → DORADA). Randomness: crypto.randomInt only. Whether a suggestion may be
// used (never a teacher's code, a class code or a retired code) is core/teachers.js validateNewCode's call.
// Never write a generated code in a page, a log line or a test's output.
// =========================================================================
'use strict';
const crypto = require('crypto');

// [word, gender]  m = masculine, f = feminine
const ANIMALS = [
  ...[
    'PANDA', 'KOALA', 'TIGRE', 'JAGUAR', 'LEOPARDO', 'GUEPARDO', 'LINCE', 'PUMA', 'LOBO', 'OSO', 'CANGURO', 'CASTOR',
    'MAPACHE', 'ERIZO', 'FLAMENCO', 'TIBURON', 'DELFIN', 'CANGREJO', 'CARACOL', 'GRILLO', 'GECKO', 'CAMALEON',
    'AJOLOTE', 'QUETZAL', 'FENEC', 'YAK', 'BISONTE', 'ALCE', 'RENO', 'CIERVO', 'POTRO', 'PONI', 'TORO', 'GALLO',
    'CANARIO', 'KIWI', 'LEMUR', 'ARMADILLO', 'TAPIR', 'OKAPI', 'NARVAL', 'PEZ', 'DINO', 'YETI', 'UNICORNIO',
    'OCELOTE', 'DRAGON', 'HALCON', 'LEON', 'TUCAN', 'PINGUINO', 'COLIBRI', 'BUHO', 'CONDOR', 'PELICANO', 'CISNE',
    'CALAMAR', 'ESCARABAJO', 'PETIRROJO', 'PANGOLIN', 'TEJON', 'BUFALO', 'COCODRILO', 'GORRION', 'AVESTRUZ',
    'DROMEDARIO', 'MURCIELAGO',
  ].map((w) => [w, 'm']),
  ...[
    'JIRAFA', 'CEBRA', 'LLAMA', 'ALPACA', 'NUTRIA', 'ARDILLA', 'ABEJA', 'HORMIGA', 'CATARINA', 'MEDUSA', 'ORCA',
    'IGUANA', 'RANA', 'GACELA', 'PANTERA', 'LEONA', 'OSA', 'SURICATA', 'LIBELULA', 'LUCIERNAGA', 'CHINCHILLA',
    'SALAMANDRA', 'AGUILA', 'GAVIOTA', 'GARZA', 'CIGARRA', 'MANTARRAYA', 'ANGUILA', 'LANGOSTA', 'GRULLA', 'CODORNIZ',
  ].map((w) => [w, 'f']),
];

// [masculine, feminine] (one word when it is the same for both)
const DESCRIBERS = [
  ...[
    'FELIZ', 'VELOZ', 'VALIENTE', 'ALEGRE', 'GENIAL', 'AMABLE', 'BRILLANTE', 'ELEGANTE', 'DULCE', 'GENTIL', 'LEAL',
    'AUDAZ', 'SAGAZ', 'TENAZ', 'VIVAZ', 'ESTELAR', 'LUNAR', 'SOLAR', 'POLAR', 'REAL', 'CELESTE', 'AZUL', 'VERDE',
    'TURQUESA', 'LILA', 'NARANJA', 'ROSA', 'VIOLETA', 'CORAL', 'MAGENTA', 'ESPACIAL', 'TURBO', 'NINJA', 'PIRATA',
    'SURFISTA', 'CANTANTE', 'ARTISTA', 'SONRIENTE', 'RADIANTE', 'NOBLE', 'FIEL', 'FUERTE', 'PACIENTE', 'TROPICAL',
    'MUSICAL', 'ASTRAL', 'GLACIAL', 'RELUCIENTE', 'ACROBATA', 'VELOCISTA',
  ].map((w) => [w, w]),
  ...[
    ['DORADO', 'DORADA'], ['PLATEADO', 'PLATEADA'], ['CURIOSO', 'CURIOSA'], ['GENEROSO', 'GENEROSA'], ['FAMOSO', 'FAMOSA'],
    ['ASTUTO', 'ASTUTA'], ['CHISTOSO', 'CHISTOSA'], ['GRACIOSO', 'GRACIOSA'], ['VALEROSO', 'VALEROSA'],
    ['DIVERTIDO', 'DIVERTIDA'], ['SABIO', 'SABIA'], ['CONTENTO', 'CONTENTA'], ['ANIMADO', 'ANIMADA'],
    ['FABULOSO', 'FABULOSA'], ['LUMINOSO', 'LUMINOSA'], ['VIAJERO', 'VIAJERA'], ['NADADOR', 'NADADORA'],
    ['ROCKERO', 'ROCKERA'], ['TRANQUILO', 'TRANQUILA'], ['SERENO', 'SERENA'], ['SALTADOR', 'SALTADORA'],
    ['CORREDOR', 'CORREDORA'], ['TIERNO', 'TIERNA'], ['ESPONJOSO', 'ESPONJOSA'], ['ALADO', 'ALADA'],
    ['VOLADOR', 'VOLADORA'], ['BONITO', 'BONITA'], ['LINDO', 'LINDA'], ['BAILARIN', 'BAILARINA'],
    ['SALTARIN', 'SALTARINA'], ['CAMPEON', 'CAMPEONA'], ['MAGICO', 'MAGICA'], ['GALACTICO', 'GALACTICA'],
    ['FANTASTICO', 'FANTASTICA'], ['SIMPATICO', 'SIMPATICA'], ['ESTUPENDO', 'ESTUPENDA'], ['LISTO', 'LISTA'],
    ['EXPLORADOR', 'EXPLORADORA'], ['PRECIOSO', 'PRECIOSA'], ['CANTOR', 'CANTORA'], ['PODEROSO', 'PODEROSA'],
    ['LEGENDARIO', 'LEGENDARIA'], ['COSMICO', 'COSMICA'], ['ELECTRICO', 'ELECTRICA'], ['HEROICO', 'HEROICA'],
    ['GLORIOSO', 'GLORIOSA'], ['ENCANTADOR', 'ENCANTADORA'],
  ],
];

// foods (Mexico, China, the Gulf and everywhere) and things kids love
const THINGS = [
  'MANGO', 'MOCHI', 'TACO', 'CHURRO', 'FLAN', 'DONA', 'GALLETA', 'PIZZA', 'PALETA', 'HELADO', 'PASTEL', 'CARAMELO',
  'CHICLE', 'NACHO', 'ELOTE', 'TAMAL', 'ARROZ', 'BAOZI', 'JIAOZI', 'TOFU', 'LICHI', 'COCO', 'PERA', 'UVA', 'LIMA',
  'MORA', 'DURAZNO', 'CIRUELA', 'MANZANA', 'CANELA', 'VAINILLA', 'MIEL', 'CACAO', 'GOMITA', 'CREPA', 'WAFFLE', 'PAN',
  'TARTA', 'SUSHI', 'RAMEN', 'FALAFEL', 'HUMMUS', 'LIMONADA', 'YOGUR', 'QUESO', 'MALVAVISCO', 'MERENGUE', 'GELATINA',
  'SORBETE', 'ALFAJOR', 'TURRON', 'MAZAPAN', 'NUEZ', 'ALMENDRA', 'PISTACHE', 'DATIL', 'POLVORON', 'CACAHUATE',
  'MANTECADA',
  'COMETA', 'COHETE', 'TROMPO', 'YOYO', 'ESTRELLA', 'LUNA', 'NUBE', 'BURBUJA', 'LINTERNA', 'FAROL', 'TAMBOR',
  'GUITARRA', 'TROMPETA', 'PATINETA', 'PLANETA', 'TESORO', 'MAPA', 'DIAMANTE', 'PERLA', 'GEMA', 'MEDALLA', 'TROFEO',
  'SOMBRERO', 'MOCHILA', 'PINCEL', 'ABANICO', 'PAPALOTE', 'SILBATO', 'CAMPANA', 'VARITA', 'CAPA', 'ROBOT',
  'SUBMARINO', 'TREN', 'VELERO', 'BARCO', 'PARAGUAS', 'BUFANDA', 'PIJAMA', 'ALMOHADA', 'DADO', 'CANICA', 'PATINES',
  'BRUJULA', 'LAMPARA', 'PIRAMIDE', 'ARCOIRIS', 'CASTILLO', 'FARO', 'CRAYON', 'PLASTILINA', 'CONFETI', 'PELUCHE',
  'TELESCOPIO', 'LUPA', 'IMAN', 'MOLINO', 'RELOJ',
];

const NUMBERS = [];
for (let n = 10; n <= 99; n++) if (n !== 69 && n !== 88) NUMBERS.push(String(n));

const MAX_LEN = 24;   // core/teachers.js validateNewCode: 8-24 characters
const pick = (arr) => arr[crypto.randomInt(arr.length)];

// One cartoon code, e.g. an animal + its describer + a food + 2 digits. `isFree(code)` (optional) says whether it may be
// used; tries until one fits in 24 characters and is free. → the code, or null (never in practice)
function suggest(isFree) {
  for (let i = 0; i < 200; i++) {
    const [animal, g] = pick(ANIMALS);
    const d = pick(DESCRIBERS);
    const code = [animal, g === 'f' ? d[1] : d[0], pick(THINGS), pick(NUMBERS)].join('-');
    if (code.length > MAX_LEN) continue;
    if (typeof isFree === 'function' && !isFree(code)) continue;
    return code;
  }
  return null;
}

module.exports = { suggest, ANIMALS, DESCRIBERS, THINGS, NUMBERS, MAX_LEN };
