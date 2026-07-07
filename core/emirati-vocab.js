// =====================================================================
// 🌐 EMIRATI ARABIC VOCABULARY — personal gateway for the platform owner
// Source: Fernando's emirati_arabic_full_text.txt (~275 words across 12
// sections). Sections 1-3 ship with example sentences; later sections are
// bare word triples and can grow into the 2,000-word target over time.
// =====================================================================

const EMIRATI_SECTIONS = {
  greet:   { id: 'greet',   label: 'Saludos y básicos',      icon: '🤲' },
  family:  { id: 'family',  label: 'Familia y personas',     icon: '👨‍👩‍👧' },
  number:  { id: 'number',  label: 'Números y dinero',       icon: '🔢' },
  food:    { id: 'food',    label: 'Comida y bebida',        icon: '🍽' },
  home:    { id: 'home',    label: 'Casa y lugares',         icon: '🏠' },
  time:    { id: 'time',    label: 'Tiempo y días',          icon: '⏰' },
  body:    { id: 'body',    label: 'Cuerpo y salud',         icon: '🩺' },
  work:    { id: 'work',    label: 'Trabajo y negocios',     icon: '💼' },
  transp:  { id: 'transp',  label: 'Transporte y direcciones', icon: '🚗' },
  emot:    { id: 'emot',    label: 'Emociones y descripciones', icon: '😊' },
  verb:    { id: 'verb',    label: 'Verbos comunes',         icon: '🏃' },
  culture: { id: 'culture', label: 'Cultura emiratí',        icon: '🇦🇪' },
  weather: { id: 'weather', label: 'Clima y naturaleza',     icon: '☀️' },
  // 🆕 2026-07-05 (Fernando): "get me more LOCAL — the most locally used
  // phrases, practical conversation language, so I can find someone in
  // the street and express myself, my background, my platform, my
  // business — in a very local Emirati way." 100 new entries, all with
  // 2 sentences, authored in EMIRATI dialect (shḥālak not shlōnak,
  // mub not mish, arūm/abā, wāyid, il-ḥīn, ʿugub, yamm, chidhī…).
  loc_street:  { id: 'loc_street',  label: 'Calle: saludos de verdad',      icon: '🗣️' },
  loc_me:      { id: 'loc_me',      label: 'Yo y mi historia',              icon: '🧔' },
  loc_biz:     { id: 'loc_biz',     label: 'Dralingo y negocios',           icon: '🐉' },
  loc_connect: { id: 'loc_connect', label: 'Conexiones y networking',       icon: '🤝' },
  loc_express: { id: 'loc_express', label: 'Opinar y sentir como local',    icon: '💬' },
  loc_power:   { id: 'loc_power',   label: 'Palabras motor (conectores)',   icon: '⚙️' },
  loc_daily:   { id: 'loc_daily',   label: 'Vida diaria en Dubái',          icon: '🌆' },
  // 🆕 2026-07-06 — second local tranche (loc101-200), Fernando's topics:
  // asking for correction, Emaar/Alabbar admiration, gratitude to the UAE,
  // his edtech founder mission, Dubai's wonders for the kids, and deep
  // majlis-level conversation. Road to 1,000 continues in tranches.
  loc_correct:  { id: 'loc_correct',  label: 'Corrígeme (aprender hablando)', icon: '🔁' },
  loc_emaar:    { id: 'loc_emaar',    label: 'Emaar, Alabbar e inspiración',  icon: '🏗️' },
  loc_grateful: { id: 'loc_grateful', label: 'Gratitud y respeto al UAE',     icon: '🇦🇪' },
  loc_founder:  { id: 'loc_founder',  label: 'Mi misión edtech',              icon: '🚀' },
  loc_wonders:  { id: 'loc_wonders',  label: 'Maravillas de Dubái',           icon: '✨' },
  loc_deep:     { id: 'loc_deep',     label: 'Conversación con alma',         icon: '🫀' },
};

let _n = 0;
function w(section, ar, tr, en, ses) {
  return { id: 'e' + (++_n), section, ar, tr, en, ses: ses || [] };
}
// 🆕 2026-07-06 — sentences can now carry their own Arabic script (`ar`).
// Without it the UI falls back to the WORD's Arabic, which made the
// sentence 🔊 play just the word (Fernando's bug report). All local-track
// sentences ship with real Arabic; legacy ones fall back as before.
function s(tr, en, ar) { const o = { tr, en }; if (ar) o.ar = ar; return o; }

const EMIRATI_WORDS = [
  // === SECTION 1: GREETINGS & BASICS ===
  w('greet', 'السلام عليكم', 'as-salaam alaykum', 'peace be upon you (hello)', [s('as-salaam alaykum, shlonkum?', 'Hello, how are you all?'), s('as-salaam alaykum, ana Fernando.', "Hello, I'm Fernando.")]),
  w('greet', 'وعليكم السلام', 'wa alaykum as-salaam', 'and upon you peace (reply)', [s('wa alaykum as-salaam, ahlan!', 'And upon you peace, welcome!'), s('A: as-salaam alaykum. B: wa alaykum as-salaam.', 'A: Hello. B: Hello back.')]),
  w('greet', 'شلونك', 'shlōnak', 'how are you (m)', [s('shlōnak il-yōm?', 'How are you today?'), s('hala, shlōnak?', 'Hey, how are you?')]),
  w('greet', 'شلونج', 'shlōnich', 'how are you (f)', [s('shlōnich il-yōm?', 'How are you today? (to a woman)'), s('hala, shlōnich?', 'Hey, how are you? (to a woman)')]),
  w('greet', 'الحمدلله', 'il-ḥamdillah', "thank God (I'm fine)", [s('il-ḥamdillah, ana b-khair.', "Thank God, I'm well."), s('shlōnak? il-ḥamdillah.', 'How are you? Fine, thank God.')]),
  w('greet', 'زين', 'zain', 'good / fine', [s("ana zain, mashkūr.", "I'm good, thanks."), s("il-yōm kān zain.", "Today was good.")]),
  w('greet', 'مرحبا', 'marḥaba', 'hello / welcome', [s('marḥaba, tafaḍḍal istariḥ.', 'Welcome, please sit down.'), s('marḥaba fīk!', 'Welcome to you!')]),
  w('greet', 'هلا', 'hala', 'hi (informal)', [s('hala hala! shlōnak?', 'Hey hey! How are you?'), s('hala walla, shakhbārak?', "Hey man, what's your news?")]),
  w('greet', 'شكرا', 'shukran', 'thank you', [s('shukran jazīlan.', 'Thank you very much.'), s('shukran ya akhī.', 'Thanks brother.')]),
  w('greet', 'عفوا', 'afwan', "you're welcome / excuse me", [s('afwan, ma alaik shay.', "You're welcome, no problem."), s('afwan, wain il-ḥammām?', 'Excuse me, where is the bathroom?')]),
  w('greet', 'مع السلامة', 'maʿ as-salāma', 'goodbye', [s("maʿ as-salāma, inshallah ashoofak.", "Goodbye, God willing I'll see you."), s('yalla, maʿ as-salāma!', 'Alright, goodbye!')]),
  w('greet', 'إن شاء الله', 'inshallah', 'God willing', [s("ashoofak bāchir inshallah.", "I'll see you tomorrow God willing."), s('inshallah kil shay zain.', 'God willing everything is good.')]),
  w('greet', 'ماشاء الله', 'māshallah', 'God has willed it (admiration)', [s('māshallah, wāyid ḥilw!', 'Mashallah, very beautiful!'), s('māshallah alaik!', 'Mashallah, well done!')]),
  w('greet', 'يلا', 'yalla', "let's go / come on", [s('yalla, namshy!', "Let's go, let's walk!"), s("yalla yalla, mit'akhirīn.", "Come on come on, we're late.")]),
  w('greet', 'نعم', 'naʿam', 'yes', [s('naʿam, ana muwāfig.', 'Yes, I agree.'), s('naʿam, ṣaḥḥ.', 'Yes, correct.')]),
  w('greet', 'إيه', 'ēh', 'yes (informal)', [s('ēh, tamām.', 'Yeah, perfect.'), s('ēh walla.', 'Yeah indeed.')]),
  w('greet', 'لا', 'lā', 'no', [s('lā, shukran.', 'No, thank you.'), s('lā, ma abī.', "No, I don't want.")]),
  w('greet', 'من فضلك', 'min faḍlak', 'please (m)', [s('min faḍlak, aʿṭīnī māy.', 'Please, give me water.'), s("min faḍlak, wain il-maṭār?", 'Please, where is the airport?')]),
  w('greet', 'آسف', 'āsif', 'sorry', [s("āsif, ma gaṣadī.", "Sorry, I didn't mean it."), s("āsif, ana mit'akhir.", "Sorry, I'm late.")]),
  w('greet', 'ما عليه', 'mā alēh', "no problem / it's okay", [s('mā alēh, ʿādī.', "No problem, it's normal."), s('A: āsif! B: mā alēh!', 'A: Sorry! B: No worries!')]),
  w('greet', 'أنا', 'ana', 'I / me', [s("ana min Honduras.", "I'm from Honduras."), s('ana adris ʿarabī.', 'I study Arabic.')]),
  w('greet', 'إنت', 'inta', 'you (m)', [s('inta min wain?', 'Where are you from?'), s("inta shaghlak shū?", "You, what's your job?")]),
  w('greet', 'هو', 'hū', 'he', [s('hū ṣāḥbī.', 'He is my friend.'), s('hū min Dubay.', 'He is from Dubai.')]),
  w('greet', 'هي', 'hī', 'she', [s('hī mudarrisa.', 'She is a teacher.'), s('hī tilʿab wāyid.', 'She plays a lot.')]),
  w('greet', 'إحنا', 'iḥna', 'we', [s('iḥna naby nākil.', 'We want to eat.'), s('iḥna min il-Imārāt.', 'We are from the Emirates.')]),

  // === SECTION 2: FAMILY & PEOPLE ===
  w('family', 'بويا', 'ab / bōya', 'father / dad', [s('il-bōya rāḥ il-shughl.', 'Dad went to work.'), s('abūy yiḥibb il-gahwa.', 'My father loves coffee.')]),
  w('family', 'يمّا', 'umm / yumma', 'mother / mom', [s('yumma ṭabkhat akil.', 'Mom cooked food.'), s('ummī aḥla waḥda.', 'My mom is the most beautiful one.')]),
  w('family', 'ولد', 'walad', 'boy / son', [s('il-walad yilʿab barra.', 'The boy is playing outside.'), s('waladī fi il-madrasa.', 'My son is at school.')]),
  w('family', 'بنت', 'bint', 'girl / daughter', [s('il-bint shāṭra.', 'The girl is clever.'), s('bintī tidris ʿarabī.', 'My daughter studies Arabic.')]),
  w('family', 'أخوي', 'akh / akhūy', 'brother', [s('akhūy fi Dubay.', 'My brother is in Dubai.'), s('akhūy il-ichbīr.', 'My older brother.')]),
  w('family', 'أختي', 'ukht / ukhtī', 'sister', [s('ukhtī tidris fi il-yāmiʿa.', 'My sister studies at the university.'), s('ukhtī ṣighīra.', 'My sister is young.')]),
  w('family', 'عيال', 'ʿyāl', 'children / kids', [s('il-ʿyāl yilʿabūn barra.', 'The kids are playing outside.'), s('kam ʿyāl ʿindak?', 'How many kids do you have?')]),
  w('family', 'يدّ', 'yadd / yidd', 'grandfather', [s('il-yidd fi il-bait.', 'Grandfather is at home.'), s('yiddī yiḥibb il-gahwa.', 'My grandfather loves coffee.')]),
  w('family', 'يدّة', 'yidda', 'grandmother', [s('il-yidda ṭabkhat machbūs.', 'Grandmother cooked machboos.'), s('yiddatī ṭayyiba.', 'My grandmother is kind.')]),
  w('family', 'عائلة', 'ʿāyla', 'family', [s('ʿāylatī ichbīra.', 'My family is big.'), s('ʿāylatī fi Dubay.', 'My family is in Dubai.')]),
  w('family', 'صاحب', 'ṣāḥib', 'friend (m)', [s('ṣāḥbī min Abu Dhabi.', 'My friend is from Abu Dhabi.'), s('ṣāḥbī zain.', 'My friend is good.')]),
  w('family', 'صاحبة', 'ṣāḥba', 'friend (f)', [s('ṣāḥbathā min il-madrasa.', 'Her friend is from school.'), s('ṣāḥbatī tishtaghil fi Dubay.', 'My friend works in Dubai.')]),
  w('family', 'ريّال', 'rayyāl', 'man', [s('il-rayyāl rāḥ il-sūg.', 'The man went to the market.'), s('rayyāl ṭayyib.', 'A good man.')]),
  w('family', 'حرمة', 'ḥurma', 'woman', [s('il-ḥurma fi il-bait.', 'The woman is at home.'), s('ḥurma shāṭra.', 'A clever woman.')]),
  w('family', 'ناس', 'nās', 'people', [s('il-nās wāyid il-yōm.', 'The people are many today.'), s('nās ṭayyibīn.', 'Kind people.')]),
  w('family', 'زوج', 'zōj', 'husband', [s('zōjhā yishtaghil fi sharīka.', 'Her husband works at a company.'), s('zōjī fi il-bait.', 'My husband is at home.')]),
  w('family', 'زوجة', 'zōja', 'wife', [s('zōjatī ṭabkhat akil lathīth.', 'My wife cooked delicious food.'), s('zōjatī fi il-shughl.', 'My wife is at work.')]),
  w('family', 'عمّ', 'ʿamm', 'uncle (paternal)', [s('ʿammī fi Al Ain.', 'My uncle is in Al Ain.'), s('ʿammī rayyāl ṭayyib.', 'My uncle is a good man.')]),
  w('family', 'خال', 'khāl', 'uncle (maternal)', [s('khālī yisāfir wāyid.', 'My uncle travels a lot.'), s('khālī fi London.', 'My uncle is in London.')]),
  w('family', 'جار', 'yār / jār', 'neighbor', [s('il-yār ṭayyib.', 'The neighbor is kind.'), s('yārnā min il-Hind.', 'Our neighbor is from India.')]),

  // === SECTION 3: NUMBERS & MONEY ===
  w('number', 'واحد', 'wāḥid', 'one', [s('wāḥid gahwa, min faḍlak.', 'One coffee, please.'), s('ana abī wāḥid bass.', 'I want just one.')]),
  w('number', 'اثنين', 'ithnain', 'two', [s('ithnain chāy, min faḍlak.', 'Two teas, please.'), s('ʿindī ithnain ʿyāl.', 'I have two children.')]),
  w('number', 'ثلاث', 'thalāth', 'three', [s('fi thalāth daqāyiq.', 'In three minutes.'), s('thalāth darāhim.', 'Three dirhams.')]),
  w('number', 'أربع', 'arbaʿ', 'four', [s('il-ijtimāʿ is-sāʿa arbaʿ.', 'The meeting is at four.'), s('arbaʿ ashkhāṣ.', 'Four people.')]),
  w('number', 'خمس', 'khams', 'five', [s('khams daqāyiq bass.', 'Just five minutes.'), s('ʿindī khams ikhwān.', 'I have five siblings.')]),
  w('number', 'ست', 'sitt', 'six', [s("is-sāʿa sitta.", "It's six o'clock."), s('sitta darāhim.', 'Six dirhams.')]),
  w('number', 'سبع', 'sabʿa', 'seven', [s("is-sāʿa sabʿa iṣ-ṣubiḥ.", "It's seven in the morning."), s('sabʿa ayyām.', 'Seven days.')]),
  w('number', 'ثمان', 'thamān', 'eight', [s("thamān is-sāʿa.", "Eight o'clock."), s('thamāniya ashkhāṣ.', 'Eight people.')]),
  w('number', 'تسع', 'tisʿa', 'nine', [s("is-sāʿa tisʿa.", "It's nine o'clock."), s('tisʿa darāhim.', 'Nine dirhams.')]),
  w('number', 'عشر', 'ʿashra', 'ten', [s('ʿashra darāhim.', 'Ten dirhams.'), s('baʿad ʿashr daqāyiq.', 'After ten minutes.')]),
  w('number', 'عشرين', 'ʿishrīn', 'twenty', [s('ʿishrīn dirham.', 'Twenty dirhams.'), s("ʿumrī ʿishrīn sana.", "I'm twenty years old.")]),
  w('number', 'مية', 'mīya', 'hundred', [s('mīya dirham.', 'One hundred dirhams.'), s('il-ḥisāb mīya w khamsīn.', 'The bill is one hundred and fifty.')]),
  w('number', 'ألف', 'alf', 'thousand', [s('alf dirham.', 'One thousand dirhams.'), s('il-ījār alfēn.', 'The rent is two thousand.')]),
  w('number', 'فلوس', 'flūs', 'money', [s('ʿindak flūs?', 'Do you have money?'), s('il-flūs fi il-bank.', 'The money is in the bank.')]),
  w('number', 'درهم', 'dirham', 'dirham (currency)', [s('kam dirham?', 'How many dirhams?'), s('ʿashr darāhim bass.', 'Just ten dirhams.')]),
  w('number', 'حساب', 'ḥisāb', 'bill / check', [s('il-ḥisāb min faḍlak.', 'The bill please.'), s('kam il-ḥisāb?', 'How much is the bill?')]),
  w('number', 'غالي', 'ghālī', 'expensive', [s('hātha ghālī wāyid.', 'This is very expensive.'), s('il-ījār ghālī fi Dubay.', 'The rent is expensive in Dubai.')]),
  w('number', 'رخيص', 'rakhīṣ', 'cheap', [s('hātha rakhīṣ.', 'This is cheap.'), s('abī shay rakhīṣ.', 'I want something cheap.')]),
  w('number', 'كم', 'kam', 'how much / how many', [s('kam il-ḥisāb?', 'How much is the bill?'), s('kam walad ʿindak?', 'How many children do you have?')]),
  w('number', 'يشتري', 'yishtrī', 'to buy', [s('abī ashtrī sayyāra.', 'I want to buy a car.'), s('wain ashtrī akil?', 'Where can I buy food?')]),

  // === SECTION 4: FOOD & DRINK (bare entries) ===
  w('food', 'أكل', 'akil', 'food'),
  w('food', 'ماي', 'māy', 'water'),
  w('food', 'خبز', 'khubz', 'bread'),
  w('food', 'لحم', 'laḥam', 'meat'),
  w('food', 'دجاج', 'dajāj', 'chicken'),
  w('food', 'سمك', 'samak', 'fish'),
  w('food', 'رز', 'ruzz', 'rice'),
  w('food', 'تمر', 'tamar', 'dates'),
  w('food', 'فواكه', 'fawākih', 'fruits'),
  w('food', 'خضار', 'khuḍār', 'vegetables'),
  w('food', 'حليب', 'ḥalīb', 'milk'),
  w('food', 'قهوة', 'gahwa', 'coffee'),
  w('food', 'شاي', 'chāy', 'tea'),
  w('food', 'عصير', 'ʿaṣīr', 'juice'),
  w('food', 'بيض', 'baiḍ', 'eggs'),
  w('food', 'زبدة', 'zubda', 'butter'),
  w('food', 'جبن', 'jubn', 'cheese'),
  w('food', 'ملح', 'milḥ', 'salt'),
  w('food', 'سكر', 'sukkar', 'sugar'),
  w('food', 'فلفل', 'filfil', 'pepper'),
  w('food', 'طماط', 'ṭamāṭ', 'tomato'),
  w('food', 'بصل', 'baṣal', 'onion'),
  w('food', 'ثوم', 'thūm', 'garlic'),
  w('food', 'ليمون', 'laimūn', 'lemon'),
  w('food', 'موز', 'mōz', 'banana'),
  w('food', 'تفاح', 'tuffāḥ', 'apple'),
  w('food', 'برتقال', 'burtugāl', 'orange'),
  w('food', 'عنب', 'ʿinab', 'grapes'),
  w('food', 'بطيخ', 'baṭṭīkh', 'watermelon'),
  w('food', 'مانجو', 'mango', 'mango'),
  w('food', 'مطعم', 'maṭʿam', 'restaurant'),
  w('food', 'كافيه', 'café', 'café'),
  w('food', 'قائمة', 'gāyma', 'menu'),
  w('food', 'طلب', 'ṭalab', 'order'),
  w('food', 'فاتورة', 'fātūra', 'bill/receipt'),
  w('food', 'ملعقة', 'milʿaga', 'spoon'),
  w('food', 'شوكة', 'shōka', 'fork'),
  w('food', 'سكين', 'sikkīn', 'knife'),
  w('food', 'صحن', 'ṣaḥin', 'plate'),
  w('food', 'كوب', 'kūb', 'glass/cup'),
  w('food', 'يطبخ', 'yaṭbakh', 'to cook'),
  w('food', 'يأكل', 'yākil', 'to eat'),
  w('food', 'يشرب', 'yishrab', 'to drink'),
  w('food', 'جوعان', 'jūʿān', 'hungry'),
  w('food', 'عطشان', 'ʿaṭshān', 'thirsty'),
  w('food', 'لذيذ', 'lathīth', 'delicious'),
  w('food', 'حار', 'ḥārr', 'spicy/hot'),
  w('food', 'بارد', 'bārid', 'cold'),
  w('food', 'حلو', 'ḥilw', 'sweet'),
  w('food', 'مر', 'murr', 'bitter'),

  // === SECTION 5: HOME & PLACES ===
  w('home', 'بيت', 'bait', 'house/home'),
  w('home', 'غرفة', 'ghurfa', 'room'),
  w('home', 'مطبخ', 'maṭbakh', 'kitchen'),
  w('home', 'حمّام', 'ḥammām', 'bathroom'),
  w('home', 'صالة', 'ṣāla', 'living room'),
  w('home', 'غرفة نوم', 'ghurfat nōm', 'bedroom'),
  w('home', 'باب', 'bāb', 'door'),
  w('home', 'شباك', 'shibbāk', 'window'),
  w('home', 'سقف', 'sagf', 'ceiling/roof'),
  w('home', 'أرض', 'arḍ', 'floor/ground'),
  w('home', 'كرسي', 'kursī', 'chair'),
  w('home', 'طاولة', 'ṭāwla', 'table'),
  w('home', 'سرير', 'sarīr', 'bed'),
  w('home', 'دولاب', 'dūlāb', 'closet/wardrobe'),
  w('home', 'ثلاجة', 'thallāja', 'fridge'),
  w('home', 'غسالة', 'ghassāla', 'washing machine'),
  w('home', 'مكيف', 'mukayif', 'AC'),
  w('home', 'مروحة', 'mirwaḥa', 'fan'),
  w('home', 'تلفزيون', 'tilifizyon', 'TV'),
  w('home', 'مفتاح', 'miftāḥ', 'key'),
  w('home', 'سوق', 'sūg', 'market'),
  w('home', 'مول', 'mōl', 'mall'),
  w('home', 'مسجد', 'masjid', 'mosque'),
  w('home', 'مستشفى', 'mustashfa', 'hospital'),
  w('home', 'صيدلية', 'ṣaidaliyya', 'pharmacy'),
  w('home', 'مطار', 'maṭār', 'airport'),
  w('home', 'فندق', 'funduq', 'hotel'),
  w('home', 'بنك', 'bank', 'bank'),
  w('home', 'مدرسة', 'madrasa', 'school'),
  w('home', 'جامعة', 'jāmiʿa', 'university'),
  w('home', 'شارع', 'shāriʿ', 'street'),
  w('home', 'دوار', 'dawwār', 'roundabout'),
  w('home', 'إشارة', 'ishāra', 'traffic light'),
  w('home', 'موقف', 'mawgif', 'parking'),
  w('home', 'جسر', 'jisr', 'bridge'),
  w('home', 'حديقة', 'ḥadīqa', 'park/garden'),
  w('home', 'شاطئ', "shāṭi'", 'beach'),
  w('home', 'جزيرة', 'jazīra', 'island'),
  w('home', 'صحراء', 'ṣaḥrā', 'desert'),
  w('home', 'جبل', 'jabal', 'mountain'),

  // === SECTION 6: TIME & DAYS ===
  w('time', 'وقت', 'wagt', 'time'),
  w('time', 'ساعة', 'sāʿa', 'hour/watch'),
  w('time', 'دقيقة', 'dagīga', 'minute'),
  w('time', 'ثانية', 'thāniya', 'second'),
  w('time', 'اليوم', 'il-yōm', 'today'),
  w('time', 'باجر', 'bāchir', 'tomorrow'),
  w('time', 'أمس', 'ams', 'yesterday'),
  w('time', 'الحين', 'il-ḥīn', 'now'),
  w('time', 'بعدين', 'baʿdain', 'later'),
  w('time', 'قبل', 'gabul', 'before'),
  w('time', 'بعد', 'baʿad', 'after'),
  w('time', 'صبح', 'ṣubuḥ', 'morning'),
  w('time', 'ضهر', 'ḍuhur', 'noon'),
  w('time', 'عصر', 'ʿaṣir', 'afternoon'),
  w('time', 'مغرب', 'maghrib', 'sunset'),
  w('time', 'ليل', 'lail', 'night'),
  w('time', 'السبت', 'is-sabt', 'Saturday'),
  w('time', 'الأحد', 'il-aḥad', 'Sunday'),
  w('time', 'الاثنين', 'il-ithnain', 'Monday'),
  w('time', 'الثلاثاء', 'ith-thalāthā', 'Tuesday'),
  w('time', 'الأربعاء', 'il-arbiʿā', 'Wednesday'),
  w('time', 'الخميس', 'il-khamīs', 'Thursday'),
  w('time', 'الجمعة', 'il-jumʿa', 'Friday'),
  w('time', 'أسبوع', 'usbūʿ', 'week'),
  w('time', 'شهر', 'shahar', 'month'),
  w('time', 'سنة', 'sana', 'year'),
  w('time', 'يناير', 'yanāyir', 'January'),
  w('time', 'فبراير', 'fibrāyir', 'February'),
  w('time', 'مارس', 'mārs', 'March'),
  w('time', 'أبريل', 'abrīl', 'April'),

  // === SECTION 7: BODY & HEALTH ===
  w('body', 'راس', 'rās', 'head'),
  w('body', 'عين', 'ʿain', 'eye'),
  w('body', 'أنف', 'anf', 'nose'),
  w('body', 'فم', 'fumm', 'mouth'),
  w('body', 'أذن', 'uthun', 'ear'),
  w('body', 'إيد', 'īd', 'hand'),
  w('body', 'ريل', 'riyyal', 'leg/foot'),
  w('body', 'بطن', 'baṭin', 'stomach'),
  w('body', 'ظهر', 'ḍahir', 'back'),
  w('body', 'قلب', 'galb', 'heart'),
  w('body', 'سن', 'sinn', 'tooth'),
  w('body', 'شعر', 'shaʿar', 'hair'),
  w('body', 'وجه', 'wayh', 'face'),
  w('body', 'رقبة', 'ragba', 'neck'),
  w('body', 'كتف', 'kitif', 'shoulder'),
  w('body', 'صبع', 'ṣubaʿ', 'finger'),
  w('body', 'ركبة', 'rukba', 'knee'),
  w('body', 'جلد', 'jild', 'skin'),
  w('body', 'دم', 'damm', 'blood'),
  w('body', 'عظم', 'ʿaḍam', 'bone'),
  w('body', 'مريض', 'marīḍ', 'sick'),
  w('body', 'صحة', 'ṣiḥḥa', 'health'),
  w('body', 'دوا', 'dawa', 'medicine'),
  w('body', 'دكتور', 'duktūr', 'doctor'),
  w('body', 'ممرض', 'mumarriḍ', 'nurse'),
  w('body', 'عملية', 'ʿamaliyya', 'surgery'),
  w('body', 'ألم', 'alam', 'pain'),
  w('body', 'حرارة', 'ḥarāra', 'fever/temperature'),
  w('body', 'زكام', 'zukām', 'cold (illness)'),
  w('body', 'صداع', 'ṣudāʿ', 'headache'),

  // === SECTION 8: WORK & BUSINESS ===
  w('work', 'شغل', 'shughl', 'work/job'),
  w('work', 'شركة', 'sharika', 'company'),
  w('work', 'مكتب', 'maktab', 'office'),
  w('work', 'اجتماع', 'ijtimāʿ', 'meeting'),
  w('work', 'مدير', 'mudīr', 'manager'),
  w('work', 'موظف', 'muwaḍḍaf', 'employee'),
  w('work', 'راتب', 'rātib', 'salary'),
  w('work', 'مشروع', 'mashrūʿ', 'project'),
  w('work', 'عقد', 'ʿagd', 'contract'),
  w('work', 'تأشيرة', "ta'shīra", 'visa'),
  w('work', 'إقامة', 'igāma', 'residence permit'),
  w('work', 'رخصة', 'rukhṣa', 'license'),
  w('work', 'تقديم', 'tagdīm', 'submission/application'),
  w('work', 'تجارة', 'tijāra', 'business/trade'),
  w('work', 'بيع', 'baiʿ', 'sale'),
  w('work', 'شراء', 'shirā', 'purchase'),
  w('work', 'سعر', 'siʿir', 'price'),
  w('work', 'خصم', 'khaṣm', 'discount'),
  w('work', 'ربح', 'ribḥ', 'profit'),
  w('work', 'خسارة', 'khasāra', 'loss'),
  w('work', 'كمبيوتر', 'kambyūtar', 'computer'),
  w('work', 'تلفون', 'talfōn', 'phone'),
  w('work', 'إيميل', 'email', 'email'),
  w('work', 'طباعة', 'ṭibāʿa', 'printing'),
  w('work', 'واي فاي', 'wāy fāy', 'Wi-Fi'),
  w('work', 'شاحن', 'shāḥin', 'charger'),
  w('work', 'شاشة', 'shāsha', 'screen'),
  w('work', 'برنامج', 'barnāmaj', 'program/app'),

  // === SECTION 9: TRANSPORT & DIRECTIONS ===
  w('transp', 'سيارة', 'sayyāra', 'car'),
  w('transp', 'باص', 'bāṣ', 'bus'),
  w('transp', 'تاكسي', 'tāksī', 'taxi'),
  w('transp', 'مترو', 'metrō', 'metro'),
  w('transp', 'طيارة', 'ṭayyāra', 'airplane'),
  w('transp', 'مركب', 'markab', 'boat'),
  w('transp', 'بترول', 'batrōl', 'gas/petrol'),
  w('transp', 'محطة', 'maḥaṭṭa', 'station'),
  w('transp', 'طريق', 'ṭarīg', 'road/way'),
  w('transp', 'يمين', 'yamīn', 'right'),
  w('transp', 'يسار', 'yasār', 'left'),
  w('transp', 'سيدا', 'sīda', 'straight'),
  w('transp', 'فوق', 'fōg', 'up/above'),
  w('transp', 'تحت', 'taḥat', 'down/below'),
  w('transp', 'يمّ', 'yamm', 'next to'),
  w('transp', 'ورا', 'wara', 'behind'),
  w('transp', 'قدام', 'guddām', 'in front'),
  w('transp', 'بعيد', 'baʿīd', 'far'),
  w('transp', 'قريب', 'garīb', 'near/close'),
  w('transp', 'وقف', 'wagaf', 'to stop'),
  w('transp', 'مشى', 'masha', 'to walk'),
  w('transp', 'سوق', 'sāg', 'to drive'),
  w('transp', 'طلع', 'ṭilaʿ', 'to go up'),
  w('transp', 'نزل', 'nizal', 'to go down'),
  w('transp', 'دور', 'dawar', 'to turn'),
  w('transp', 'وصل', 'wiṣal', 'to arrive'),
  w('transp', 'رجع', 'rajaʿ', 'to return'),
  w('transp', 'سافر', 'sāfar', 'to travel'),
  w('transp', 'ركب', 'rikab', 'to ride/get in'),

  // === SECTION 10: EMOTIONS & DESCRIPTIONS ===
  w('emot', 'فرحان', 'farḥān', 'happy'),
  w('emot', 'زعلان', 'zaʿlān', 'upset/angry'),
  w('emot', 'تعبان', 'taʿbān', 'tired'),
  w('emot', 'خايف', 'khāyif', 'scared'),
  w('emot', 'مستانس', 'mistānis', 'excited/having fun'),
  w('emot', 'ملّان', 'mallān', 'bored'),
  w('emot', 'مشتاق', 'mishtāg', 'missing someone'),
  w('emot', 'حزين', 'ḥazīn', 'sad'),
  w('emot', 'مبسوط', 'mabsūṭ', 'pleased'),
  w('emot', 'قلقان', 'galqān', 'worried'),
  w('emot', 'كبير', 'ichbīr', 'big'),
  w('emot', 'صغير', 'ṣighīr', 'small'),
  w('emot', 'طويل', 'ṭawīl', 'tall/long'),
  w('emot', 'قصير', 'gaṣīr', 'short'),
  w('emot', 'ثقيل', 'thagīl', 'heavy'),
  w('emot', 'خفيف', 'khafīf', 'light'),
  w('emot', 'يديد', 'ydīd', 'new'),
  w('emot', 'قديم', 'gadīm', 'old'),
  w('emot', 'شين', 'shain', 'ugly'),
  w('emot', 'خوش', 'khōsh', 'good/nice'),
  w('emot', 'وايد', 'wāyid', 'very/a lot'),
  w('emot', 'شوي', 'shway', 'a little'),
  w('emot', 'كلّ', 'kull', 'all/every'),
  w('emot', 'بعض', 'baʿaḍ', 'some'),
  w('emot', 'أول', 'awwal', 'first'),
  w('emot', 'آخر', 'ākhir', 'last'),
  w('emot', 'صعب', 'ṣaʿab', 'difficult'),
  w('emot', 'سهل', 'sahil', 'easy'),

  // === SECTION 11: COMMON VERBS ===
  w('verb', 'يبي', 'yabī', 'to want'),
  w('verb', 'يروح', 'yrūḥ', 'to go'),
  w('verb', 'ييي', 'yīy', 'to come'),
  w('verb', 'ينام', 'ynām', 'to sleep'),
  w('verb', 'يقوم', 'ygūm', 'to wake up/stand'),
  w('verb', 'يحب', 'yiḥibb', 'to love/like'),
  w('verb', 'يعرف', 'yaʿruf', 'to know'),
  w('verb', 'يقدر', 'yigdar', 'to be able'),
  w('verb', 'يسوي', 'ysawwī', 'to do/make'),
  w('verb', 'يشتغل', 'yishtaghil', 'to work'),
  w('verb', 'يدرس', 'yidris', 'to study'),
  w('verb', 'يتكلم', 'yitkallam', 'to speak'),
  w('verb', 'يسمع', 'yismaʿ', 'to hear/listen'),
  w('verb', 'يشوف', 'yshūf', 'to see/look'),
  w('verb', 'يقول', 'ygūl', 'to say'),
  w('verb', 'يكتب', 'yiktib', 'to write'),
  w('verb', 'يقرا', 'yigra', 'to read'),
  w('verb', 'يفتح', 'yiftaḥ', 'to open'),
  w('verb', 'يسكر', 'yisakir', 'to close'),
  w('verb', 'يطلع', 'yiṭlaʿ', 'to go out'),
  w('verb', 'يدخل', 'yidkhil', 'to enter'),
  w('verb', 'يمشي', 'yimshī', 'to walk'),
  w('verb', 'يركض', 'yarkuḍ', 'to run'),
  w('verb', 'يسبح', 'yisbaḥ', 'to swim'),
  w('verb', 'يلعب', 'yilʿab', 'to play'),
  w('verb', 'يضحك', 'yiḍḥak', 'to laugh'),
  w('verb', 'يبكي', 'yibchī', 'to cry'),
  w('verb', 'يفكر', 'yifakkir', 'to think'),
  w('verb', 'يحتاج', 'yiḥtāj', 'to need'),
  w('verb', 'يحاول', 'yiḥāwil', 'to try'),
  w('verb', 'يساعد', 'ysāʿid', 'to help'),
  w('verb', 'يبدأ', 'yibda', 'to start'),
  w('verb', 'يخلص', 'yikhalliṣ', 'to finish'),
  w('verb', 'يرجع', 'yirjaʿ', 'to return'),
  w('verb', 'ينتظر', 'yintaḍir', 'to wait'),
  w('verb', 'يدفع', 'yidfaʿ', 'to pay'),
  w('verb', 'يبيع', 'ybīʿ', 'to sell'),
  w('verb', 'يوصل', 'yūṣal', 'to arrive/deliver'),

  // === SECTION 12: UAE CULTURE & PLACES ===
  w('culture', 'إمارات', 'Imārāt', 'Emirates'),
  w('culture', 'دبي', 'Dubay', 'Dubai'),
  w('culture', 'أبوظبي', 'Abu Ḍabī', 'Abu Dhabi'),
  w('culture', 'شارقة', 'Shārga', 'Sharjah'),
  w('culture', 'عجمان', 'ʿAjmān', 'Ajman'),
  w('culture', 'رأس الخيمة', 'Rās il-Khaima', 'Ras Al Khaimah'),
  w('culture', 'فجيرة', 'Fujayra', 'Fujairah'),
  w('culture', 'أم القيوين', 'Umm il-Gaiwain', 'Umm Al Quwain'),
  w('culture', 'شيخ', 'shaikh', 'sheikh'),
  w('culture', 'حاكم', 'ḥākim', 'ruler'),
  w('culture', 'وزير', 'wazīr', 'minister'),
  w('culture', 'حكومة', 'ḥukūma', 'government'),
  w('culture', 'مجلس', 'majlis', 'council/gathering'),
  w('culture', 'عيد', 'ʿīd', 'holiday/celebration'),
  w('culture', 'رمضان', 'ramaḍān', 'Ramadan'),
  w('culture', 'حج', 'ḥajj', 'pilgrimage'),
  w('culture', 'كندورة', 'kandūra', "men's white robe"),
  w('culture', 'عباية', 'ʿabāya', "women's black robe"),
  w('culture', 'غترة', 'ghutra', 'headscarf (men)'),
  w('culture', 'عقال', 'ʿigāl', 'headband (men)'),
  w('culture', 'شيلة', 'shēla', 'headscarf (women)'),
  w('culture', 'برقع', 'burgaʿ', 'face mask (traditional)'),
  w('culture', 'برج', 'burj', 'tower'),
  w('culture', 'واحة', 'wāḥa', 'oasis'),
  w('culture', 'خور', 'khōr', 'creek/inlet'),
  w('culture', 'كورنيش', 'kōrnīsh', 'corniche'),
  w('culture', 'منطقة حرة', 'manṭiga ḥurra', 'free zone'),

  // === SECTION 13: WEATHER & NATURE ===
  w('weather', 'حر', 'ḥarr', 'hot (weather)'),
  w('weather', 'برد', 'bard', 'cold (weather)'),
  w('weather', 'شمس', 'shams', 'sun'),
  w('weather', 'غيم', 'ghaim', 'clouds'),
  w('weather', 'مطر', 'maṭar', 'rain'),
  w('weather', 'رياح', 'riyāḥ', 'wind'),
  w('weather', 'رطوبة', 'ruṭūba', 'humidity'),
  w('weather', 'عاصفة', 'ʿāṣifa', 'storm'),
  w('weather', 'غبار', 'ghubār', 'dust'),
  w('weather', 'رمل', 'raml', 'sand'),
  w('weather', 'بحر', 'baḥar', 'sea'),
  w('weather', 'نهر', 'nahar', 'river'),
  w('weather', 'شجر', 'shajar', 'trees'),
  w('weather', 'ورد', 'ward', 'flowers'),
  w('weather', 'نجم', 'najm', 'star'),
  w('weather', 'قمر', 'gamar', 'moon'),
  w('weather', 'سما', 'sama', 'sky'),
  w('weather', 'هوا', 'hawa', 'air/weather'),
];

// ═════════════════════════════════════════════════════════════════════
// 🇦🇪 LOCAL EMIRATI TRACK — 100 entries, 2026-07-05. Own id prefix
// ('loc1'…'loc100') so the positional 'eN' ids above NEVER shift and
// Fernando's seen/learned marks stay valid. These sections go FIRST in
// EMIRATI_SECTION_ORDER, so the study queue starts here.
// Dialect notes baked in: shḥālak (not shlōnak), mub (not mish/lā),
// arūm (I can — uniquely Emirati), abā (I want), wāyid (very),
// il-ḥīn (now), ʿugub (after), yamm (next to), chidhī (like this),
// sīdā (straight), lēn (until), māl (belongs to), tawnī (I just…).
// ═════════════════════════════════════════════════════════════════════
let _ln = 0;
function lw(section, ar, tr, en, ses) {
  return { id: 'loc' + (++_ln), section, ar, tr, en, ses: ses || [] };
}
const EMIRATI_LOCAL_WORDS = [
  // === 🗣️ CALLE: SALUDOS DE VERDAD (15) ===
  lw('loc_street', 'شحالك', 'shḥālak', 'how are you (m) — THE Emirati greeting', [s('hala wallah! shḥālak?', 'Hey! How are you?', 'هلا والله! شحالك؟'), s('shḥālak il-yōm, kil shay tamām?', 'How are you today, everything good?', 'شحالك اليوم، كل شي تمام؟')]),
  lw('loc_street', 'شحالچ', 'shḥālich', 'how are you (f)', [s('shḥālich il-yōm?', 'How are you today? (to a woman)', 'شحالچ اليوم؟'), s('marḥaba, shḥālich?', 'Hello, how are you? (f)', 'مرحبا، شحالچ؟')]),
  lw('loc_street', 'شخبارك', 'shakhbārak', "what's your news", [s('shakhbārak? kilshay zēn?', "What's your news? All good?", 'شخبارك؟ كلشي زين؟'), s('shakhbārak wiyya il-shughl?', "How's it going with work?", 'شخبارك ويا الشغل؟')]),
  lw('loc_street', 'علومك', 'ʿilūmak', 'your news? (super local)', [s('ʿilūmak? shū msawwī?', "What's up? What are you up to?", 'علومك؟ شو مسوي؟'), s('hala, ʿilūmak il-yōm?', "Hey, what's your news today?", 'هلا، علومك اليوم؟')]),
  lw('loc_street', 'حياك الله', 'ḥayyāk allāh', 'welcome / God greet you', [s('ḥayyāk allāh fi baitna.', 'Welcome to our home.', 'حياك الله في بيتنا.'), s('taʿāl ʿindnā, ḥayyāk allāh.', 'Come over, you are most welcome.', 'تعال عندنا، حياك الله.')]),
  lw('loc_street', 'مرحبا الساع', 'marḥabā is-sāʿ', 'grand Emirati welcome', [s('marḥabā is-sāʿ! tfaḍḍal!', 'A big welcome! Come in!', 'مرحبا الساع! تفضل!'), s('marḥabā is-sāʿ, nawwart!', 'Welcome! You light the place up!', 'مرحبا الساع، نورت!')]),
  lw('loc_street', 'وينك', 'wēnak', 'where have you been!', [s('wēnak yā rayyāl, min zamān!', 'Where have you been man, long time!', 'وينك يا ريال، من زمان!'), s('wēnak? mā shiftik min asbūʿ!', "Where are you? Haven't seen you in a week!", 'وينك؟ ما شفتك من أسبوع!')]),
  lw('loc_street', 'من زمان', 'min zamān', 'long time (no see)', [s('min zamān mā shiftik!', "Long time I haven't seen you!", 'من زمان ما شفتك!'), s('min zamān ʿan il-gahwa maʿ baʿaḍ.', "It's been long since we had coffee together.", 'من زمان عن القهوة مع بعض.')]),
  lw('loc_street', 'مشكور', 'mashkūr', 'thank you (Gulf style)', [s('mashkūr ʿalā kil shay.', 'Thanks for everything.', 'مشكور على كل شي.'), s('mashkūr yā ṭawīl il-ʿumr.', 'Thank you, kind sir.', 'مشكور يا طويل العمر.')]),
  lw('loc_street', 'تسلم', 'tislam', 'bless you (thanks/reply)', [s('tislam yā ghālī.', 'Bless you, dear.', 'تسلم يا غالي.'), s('tislam ʿala hal-musāʿada.', 'Bless you for this help.', 'تسلم على هالمساعدة.')]),
  lw('loc_street', 'يا طويل العمر', 'yā ṭawīl il-ʿumr', 'respectful address ("o long-lived")', [s('shukran yā ṭawīl il-ʿumr.', 'Thank you, respected one.', 'شكرا يا طويل العمر.'), s('yā ṭawīl il-ʿumr, mumkin suʾāl?', 'Respected sir, may I ask something?', 'يا طويل العمر، ممكن سؤال؟')]),
  lw('loc_street', 'أبشر', 'abshir', 'consider it done!', [s('tabā musāʿada? abshir!', 'You want help? Consider it done!', 'تبا مساعدة؟ أبشر!'), s('abshir, kil shay bikūn jāhiz bāchir.', 'Done deal — everything will be ready tomorrow.', 'أبشر، كل شي بيكون جاهز باچر.')]),
  lw('loc_street', 'على راسي', 'ʿalā rāsī', 'with pleasure ("on my head")', [s('ʿalā rāsī, mā yiḥtāj tiṭlub.', "With pleasure, you don't even need to ask.", 'على راسي، ما يحتاج تطلب.'), s('ṭalabak ʿalā rāsī.', 'Your request is my honor.', 'طلبك على راسي.')]),
  lw('loc_street', 'عساك بخير', 'ʿasāk b-khair', 'hope you are well', [s('ʿasāk b-khair dāyman.', 'May you always be well.', 'عساك بخير دايما.'), s('shḥālak? ʿasāk b-khair.', 'How are you? Hope all is well.', 'شحالك؟ عساك بخير.')]),
  lw('loc_street', 'الله يسلمك', 'allāh yisalmik', 'God keep you (warm reply)', [s('A: maʿ as-salāma! B: allāh yisalmik.', 'A: Goodbye! B: God keep you.', 'A: مع السلامة! B: الله يسلمك.'), s('mashkūr! — allāh yisalmik.', 'Thanks! — God keep you safe.', 'مشكور! — الله يسلمك.')]),

  // === 🧔 YO Y MI HISTORIA (15) ===
  lw('loc_me', 'أنا من هندوراس', 'ana min Hondūrās', "I'm from Honduras", [s('ana min Hondūrās, min Amrīkā il-wusṭā.', "I'm from Honduras, from Central America.", 'أنا من هندوراس، من أمريكا الوسطى.'), s('ṣij? ēh wallah, ana min Hondūrās!', 'Really? Yes indeed, I am from Honduras!', 'صج؟ إيه والله، أنا من هندوراس!')]),
  lw('loc_me', 'عايش في دبي', 'ʿāyish fi Dubay', 'living in Dubai', [s('ana ʿāyish fi Dubay w mistānis wāyid.', 'I live in Dubai and I love it.', 'أنا عايش في دبي ومستانس وايد.'), s('ʿāyish fi Dubay min sinīn.', 'I have been living in Dubai for years.', 'عايش في دبي من سنين.')]),
  lw('loc_me', 'مدرّس', 'mudarris', 'teacher', [s('ana mudarris lughāt.', 'I am a language teacher.', 'أنا مدرّس لغات.'), s('ashtaghil mudarris fi Dubay.', 'I work as a teacher in Dubai.', 'أشتغل مدرّس في دبي.')]),
  lw('loc_me', 'أدرّس صيني', 'adarris ṣīnī', 'I teach Chinese', [s('adarris ṣīnī lil-ʿyāl.', 'I teach Chinese to kids.', 'أدرّس صيني للعيال.'), s('adarris ṣīnī mandarīnī fi il-madāris.', 'I teach Mandarin Chinese in schools.', 'أدرّس صيني مندريني في المدارس.')]),
  lw('loc_me', 'أتكلم ثلاث لغات', 'atkallam thalāth lughāt', 'I speak three languages', [s('atkallam isbānī w inglīzī w ṣīnī.', 'I speak Spanish, English and Chinese.', 'أتكلم إسباني وإنجليزي وصيني.'), s('w il-ḥīn atʿallam ʿarabī baʿad!', 'And now I am learning Arabic too!', 'والحين أتعلم عربي بعد!')]),
  lw('loc_me', 'أتعلم عربي', 'atʿallam ʿarabī', 'I am learning Arabic', [s('atʿallam ʿarabī imārātī, mub fuṣḥā bass.', 'I learn Emirati Arabic, not just standard.', 'أتعلم عربي إماراتي، مب فصحى بس.'), s('atʿallam ʿarabī ʿashān aḥibb hal-balad.', 'I learn Arabic because I love this country.', 'أتعلم عربي عشان أحب هالبلد.')]),
  lw('loc_me', 'لغتي الأم', 'lughatī il-umm', 'my mother tongue', [s('lughatī il-umm isbānī.', 'My mother tongue is Spanish.', 'لغتي الأم إسباني.'), s('il-isbānī lughatī il-umm, bass galbī yiḥibb il-lughāt killahā.', 'Spanish is my mother tongue, but my heart loves all languages.', 'الإسباني لغتي الأم، بس قلبي يحب اللغات كلها.')]),
  lw('loc_me', 'أحب الإمارات', 'aḥibb il-Imārāt', 'I love the Emirates', [s('aḥibb il-Imārāt wāyid.', 'I love the Emirates a lot.', 'أحب الإمارات وايد.'), s('aḥibb il-Imārāt ʿashān in-nās ṭayyibīn.', 'I love the UAE because the people are kind.', 'أحب الإمارات عشان الناس طيبين.')]),
  lw('loc_me', 'ييت دبي', 'yīt Dubay', 'I came to Dubai', [s('yīt Dubay ʿashān il-shughl.', 'I came to Dubai for work.', 'ييت دبي عشان الشغل.'), s('yīt Dubay w ligēt bait thānī.', 'I came to Dubai and found a second home.', 'ييت دبي ولقيت بيت ثاني.')]),
  lw('loc_me', 'خبرة', 'khibra', 'experience', [s('ʿindī khibra fi taʿlīm il-ʿyāl.', 'I have experience teaching kids.', 'عندي خبرة في تعليم العيال.'), s('khibratī fi it-taʿlīm sinīn ṭawīla.', 'My experience in teaching is many years.', 'خبرتي في التعليم سنين طويلة.')]),
  lw('loc_me', 'حلمي', 'ḥilmī', 'my dream', [s('ḥilmī arbiṭ ith-thaqāfāt bil-lugha.', 'My dream is to connect cultures through language.', 'حلمي أربط الثقافات باللغة.'), s('ḥilmī minaṣṣatī tūṣal kil bait.', 'My dream is that my platform reaches every home.', 'حلمي منصتي توصل كل بيت.')]),
  lw('loc_me', 'أهلي', 'ahlī', 'my family (back home)', [s('ahlī fi Hondūrās.', 'My family is in Honduras.', 'أهلي في هندوراس.'), s('akallim ahlī kil yōm.', 'I talk to my family every day.', 'أكلم أهلي كل يوم.')]),
  lw('loc_me', 'اشتقت لأهلي', 'ishtagt l-ahlī', 'I miss my family', [s('ishtagt l-ahlī wāyid.', 'I miss my family a lot.', 'اشتقت لأهلي وايد.'), s('ishtagt l-ahlī, bass Dubay bait-ī baʿad.', 'I miss my family, but Dubai is my home too.', 'اشتقت لأهلي، بس دبي بيتي بعد.')]),
  lw('loc_me', 'مستانس', 'mistānis', 'happy / having a great time (very Emirati)', [s('ana mistānis fi Dubay.', 'I am really happy in Dubai.', 'أنا مستانس في دبي.'), s('mistānis wāyid fi shughlī.', 'I really enjoy my work.', 'مستانس وايد في شغلي.')]),
  lw('loc_me', 'قصتي', 'giṣṣatī', 'my story', [s('giṣṣatī ṭawīla bass ḥilwa.', 'My story is long but beautiful.', 'قصتي طويلة بس حلوة.'), s('abā aḥachīk ʿan giṣṣatī.', 'I want to tell you my story.', 'أبا أحاچيك عن قصتي.')]),

  // === 🐉 DRALINGO Y NEGOCIOS (15) ===
  lw('loc_biz', 'منصة', 'minaṣṣa', 'platform', [s('ʿindī minaṣṣa taʿlīmiyya ismhā Dralingo.', 'I have an educational platform called Dralingo.', 'عندي منصة تعليمية اسمها درالينجو.'), s('il-minaṣṣa mālitī lil-ʿyāl.', 'My platform is for kids.', 'المنصة مالتي للعيال.')]),
  lw('loc_biz', 'مشروع', 'mashrūʿ', 'project / venture', [s('ʿindī mashrūʿ taʿlīmī fi Dubay.', 'I have an educational venture in Dubai.', 'عندي مشروع تعليمي في دبي.'), s('il-mashrūʿ yikbar shway shway.', 'The project grows little by little.', 'المشروع يكبر شوي شوي.')]),
  lw('loc_biz', 'تعليم بالألعاب', 'taʿlīm bil-alʿāb', 'learning through games', [s('ṭarīqatnā taʿlīm bil-alʿāb.', 'Our method is learning through games.', 'طريقتنا تعليم بالألعاب.'), s('il-ʿyāl yiḥibbūn it-taʿlīm bil-alʿāb.', 'Kids love learning through games.', 'العيال يحبون التعليم بالألعاب.')]),
  lw('loc_biz', 'يتعلمون وهم يلعبون', 'yitʿallamūn w hum yilʿabūn', 'they learn while playing', [s('il-ʿyāl yitʿallamūn w hum yilʿabūn.', 'The kids learn while they play.', 'العيال يتعلمون وهم يلعبون.'), s('ʿindnā, yitʿallamūn w hum mistānsīn.', 'With us, they learn while having fun.', 'عندنا، يتعلمون وهم مستانسين.')]),
  lw('loc_biz', 'تنين', 'tinnīn', 'dragon (the mascot!)', [s('shiʿārnā tinnīn azrag ismah Dralingo.', 'Our mascot is a blue dragon called Dralingo.', 'شعارنا تنين أزرق اسمه درالينجو.'), s('il-ʿyāl yiḥibbūn it-tinnīn māl il-minaṣṣa.', 'The kids love the platform\'s dragon.', 'العيال يحبون التنين مال المنصة.')]),
  lw('loc_biz', 'شركة', 'sharika', 'company', [s('abā afattiḥ sharika fi Dubay.', 'I want to open a company in Dubai.', 'أبا أفتح شركة في دبي.'), s('ish-sharika mālitnā ṣighīra bass ṭamūḥa.', 'Our company is small but ambitious.', 'الشركة مالتنا صغيرة بس طموحة.')]),
  lw('loc_biz', 'زبون', 'zabūn', 'customer', [s('iz-zabāyin mistānsīn wāyid.', 'The customers are very happy.', 'الزباين مستانسين وايد.'), s('kil zabūn ʿindnā mithl il-ʿāyla.', 'Every customer of ours is like family.', 'كل زبون عندنا مثل العايلة.')]),
  lw('loc_biz', 'مدارس', 'madāris', 'schools', [s('ashtaghil wiyya madāris fi Dubay.', 'I work with schools in Dubai.', 'أشتغل ويا مدارس في دبي.'), s('nabā nūṣal l-madāris akthar.', 'We want to reach more schools.', 'نبا نوصل لمدارس أكثر.')]),
  lw('loc_biz', 'اجتماع', 'ijtimāʿ', 'meeting', [s('ʿindī ijtimāʿ bāchir iṣ-ṣubḥ.', 'I have a meeting tomorrow morning.', 'عندي اجتماع باچر الصبح.'), s('khalna nsawwī ijtimāʿ hal-isbūʿ.', 'Let\'s set a meeting this week.', 'خلنا نسوي اجتماع هالأسبوع.')]),
  lw('loc_biz', 'شراكة', 'sharāka', 'partnership', [s('nadawwir sharāka wiyya madāris hnīh.', 'We are looking for a partnership with schools here.', 'ندور شراكة ويا مدارس هنيه.'), s('ish-sharāka tfīd iṭ-ṭarafēn.', 'The partnership benefits both sides.', 'الشراكة تفيد الطرفين.')]),
  lw('loc_biz', 'سوّيت', 'sawwait', 'I made / I built (very Emirati)', [s('sawwait barnāmij lil-ʿyāl.', 'I built a program for kids.', 'سويت برنامج للعيال.'), s('sawwait kil shay b-rūḥī.', 'I made everything myself.', 'سويت كل شي بروحي.')]),
  lw('loc_biz', 'يشتغل عدل', 'yishtaghil ʿadil', 'it works properly', [s('il-barnāmij yishtaghil ʿadil.', 'The program works properly.', 'البرنامج يشتغل عدل.'), s('kil shay yishtaghil ʿadil, il-ḥamdillah.', 'Everything runs properly, thank God.', 'كل شي يشتغل عدل، الحمدلله.')]),
  lw('loc_biz', 'هدفنا', 'hadafnā', 'our goal', [s('hadafnā it-taʿlīm yiṣīr mitʿa.', 'Our goal is that learning becomes fun.', 'هدفنا التعليم يصير متعة.'), s('hadafnā nirbiṭ iṣ-Ṣīn wil-Imārāt wil-ʿālam.', 'Our goal is to connect China, the UAE and the world.', 'هدفنا نربط الصين والإمارات والعالم.')]),
  lw('loc_biz', 'مجاني', 'majjānī', 'free (of charge)', [s('it-tajruba il-ūlā majjāniyya.', 'The first trial is free.', 'التجربة الأولى مجانية.'), s('fī juzʾ majjānī ḥagg kil wāḥid.', 'There is a free part for everyone.', 'في جزء مجاني حق كل واحد.')]),
  lw('loc_biz', 'جرّب', 'jarrib', 'try it!', [s('jarrib il-minaṣṣa, btiḥibbhā!', 'Try the platform, you will love it!', 'جرّب المنصة، بتحبها!'), s('jarrib marra waḥda bass.', 'Just try it once.', 'جرّب مرة وحدة بس.')]),

  // === 🤝 CONEXIONES Y NETWORKING (10) ===
  lw('loc_connect', 'نتعاون', 'nitʿāwan', "let's collaborate", [s('mumkin nitʿāwan fi hal-mashrūʿ?', 'Could we collaborate on this project?', 'ممكن نتعاون في هالمشروع؟'), s('lō nitʿāwan, kilnā nistafīd.', 'If we collaborate, we all benefit.', 'لو نتعاون، كلنا نستفيد.')]),
  lw('loc_connect', 'عطني رقمك', 'ʿaṭnī ragmak', 'give me your number', [s('ʿaṭnī ragmak w akallimk bāchir.', "Give me your number and I'll call you tomorrow.", 'عطني رقمك وأكلمك باچر.'), s('ʿaṭnī ragmak ʿala il-wātsāb.', 'Give me your WhatsApp number.', 'عطني رقمك على الواتساب.')]),
  lw('loc_connect', 'نتواصل', 'nitwāṣal', "let's keep in touch", [s('khalna nitwāṣal ʿala il-wātsāb.', "Let's keep in touch on WhatsApp.", 'خلنا نتواصل على الواتساب.'), s('nitwāṣal ʿugub il-ijtimāʿ.', 'We will connect after the meeting.', 'نتواصل عقب الاجتماع.')]),
  lw('loc_connect', 'أعرفك على', 'aʿarrfik ʿala', 'let me introduce you to', [s('aʿarrfik ʿala ṣāḥbī, ʿindah madrasa.', 'Let me introduce you to my friend, he owns a school.', 'أعرفك على صاحبي، عنده مدرسة.'), s('taʿāl aʿarrfik ʿala il-mudīr.', 'Come, let me introduce you to the director.', 'تعال أعرفك على المدير.')]),
  lw('loc_connect', 'تشرفنا', 'tsharrafnā', 'pleased to meet you', [s('tsharrafnā! ana Fernando.', 'Pleased to meet you! I am Fernando.', 'تشرفنا! أنا فرناندو.'), s('tsharrafnā b-maʿriftik.', 'Honored to know you.', 'تشرفنا بمعرفتك.')]),
  lw('loc_connect', 'تبا قهوة؟', 'tabā gahwa?', 'want a coffee?', [s('tabā gahwa? ana ʿāzmik.', 'Want a coffee? My treat.', 'تبا قهوة؟ أنا عازمك.'), s('nitgahwā maʿ baʿaḍ ʿugub id-dawām?', 'Shall we grab coffee together after work?', 'نتقهوى مع بعض عقب الدوام؟')]),
  lw('loc_connect', 'مجلس', 'majlis', 'majlis (Emirati gathering)', [s('ʿazamnī ʿala il-majlis.', 'He invited me to the majlis.', 'عزمني على المجلس.'), s('fi il-majlis titʿallam akthar min il-kutub.', 'In the majlis you learn more than from books.', 'في المجلس تتعلم أكثر من الكتب.')]),
  lw('loc_connect', 'عزيمة', 'ʿazīma', 'invitation (to a meal/gathering)', [s('shukran ʿala il-ʿazīma.', 'Thank you for the invitation.', 'شكرا على العزيمة.'), s('il-ʿazīma ʿalayy il-marra il-yāya.', 'Next time the invitation is on me.', 'العزيمة عليّ المرة الياية.')]),
  lw('loc_connect', 'واسطة', 'wāsṭa', 'connections / who-you-know', [s('fi il-khalīj, il-wāsṭa tsāʿid wāyid.', 'In the Gulf, connections help a lot.', 'في الخليج، الواسطة تساعد وايد.'), s('mub wāsṭa bass — shughl zēn baʿad.', 'Not just connections — good work too.', 'مب واسطة بس — شغل زين بعد.')]),
  lw('loc_connect', 'تفضل', 'tfaḍḍal', 'here you go / please, go ahead', [s('tfaḍḍal, hāda kartī.', 'Here you go, this is my card.', 'تفضل، هذا كرتي.'), s('tfaḍḍal istariḥ, il-bait baitik.', 'Please sit, make yourself at home.', 'تفضل استرح، البيت بيتك.')]),

  // === 💬 OPINAR Y SENTIR COMO LOCAL (15) ===
  lw('loc_express', 'بصراحة', 'b-ṣarāḥa', 'honestly / frankly', [s('b-ṣarāḥa, il-fikra wāyid zēna.', 'Honestly, the idea is really good.', 'بصراحة، الفكرة وايد زينة.'), s('b-ṣarāḥa, mā ʿajabnī il-maṭʿam.', "Honestly, I didn't like the restaurant.", 'بصراحة، ما عجبني المطعم.')]),
  lw('loc_express', 'أشوف إن', 'ashūf inn', 'I think that ("I see that")', [s('ashūf inn it-taʿlīm lāzim yitghayyar.', 'I think education needs to change.', 'أشوف إن التعليم لازم يتغير.'), s('ashūf inn il-ʿyāl yitʿallamūn asraʿ bil-laʿib.', 'I think kids learn faster through play.', 'أشوف إن العيال يتعلمون أسرع باللعب.')]),
  lw('loc_express', 'بالنسبة لي', 'bin-nisba lī', 'as for me / in my view', [s('bin-nisba lī, il-ʿāyla awwal shay.', 'For me, family comes first.', 'بالنسبة لي، العايلة أول شي.'), s('bin-nisba lī, Dubay aḥsan makān lil-mashārīʿ.', 'For me, Dubai is the best place for ventures.', 'بالنسبة لي، دبي أحسن مكان للمشاريع.')]),
  lw('loc_express', 'والله', 'wallah', 'I swear / really', [s('wallah il-mashrūʿ nājiḥ!', 'I swear the project is succeeding!', 'والله المشروع ناجح!'), s('wallah mā adrī.', "Honestly, I don't know.", 'والله ما أدري.')]),
  lw('loc_express', 'صج', 'ṣij', 'true / really (Emirati)', [s('ṣij? mā ṣaddagt!', "Really? I couldn't believe it!", 'صج؟ ما صدقت!'), s('kalāmik ṣij.', 'What you say is true.', 'كلامك صج.')]),
  lw('loc_express', 'ما صدقت', 'mā ṣaddagt', "I couldn't believe it", [s('mā ṣaddagt lamma shift in-natīja.', "I couldn't believe it when I saw the result.", 'ما صدقت لما شفت النتيجة.'), s('mā ṣaddagt inn il-ʿyāl khallṣaw kil shay.', "I couldn't believe the kids finished everything.", 'ما صدقت إن العيال خلصوا كل شي.')]),
  lw('loc_express', 'أحس إن', 'aḥiss inn', 'I feel that', [s('aḥiss inn il-ʿarabī il-imārātī aḥlā.', 'I feel Emirati Arabic is more beautiful.', 'أحس إن العربي الإماراتي أحلى.'), s('aḥiss inn hal-balad yaʿṭīk furṣa.', 'I feel this country gives you opportunity.', 'أحس إن هالبلد يعطيك فرصة.')]),
  lw('loc_express', 'يعجبني', 'yiʿjibnī', 'I like (it pleases me)', [s('yiʿjibnī it-turāth il-imārātī.', 'I like Emirati heritage.', 'يعجبني التراث الإماراتي.'), s('yiʿjibnī shlōn in-nās yistaqbilūnik hnīh.', 'I like how people welcome you here.', 'يعجبني شلون الناس يستقبلونك هنيه.')]),
  lw('loc_express', 'ما يخالف', 'mā yikhālif', "no problem / that's fine", [s('mā yikhālif, nsawwīhā bāchir.', "No problem, we'll do it tomorrow.", 'ما يخالف، نسويها باچر.'), s('titʾakhkhar shway? mā yikhālif.', "You'll be a bit late? That's fine.", 'تتأخر شوي؟ ما يخالف.')]),
  lw('loc_express', 'إن شاء الله خير', 'inshallah khair', 'God willing, all will be well', [s('lā tḥātī, inshallah khair.', "Don't worry, it will be fine, God willing.", 'لا تحاتي، إن شاء الله خير.'), s('inshallah khair, kil shay b-wagtah.', 'All will be well — everything in its time.', 'إن شاء الله خير، كل شي بوقته.')]),
  lw('loc_express', 'أتمنى', 'atmannā', 'I hope / I wish', [s('atmannā minaṣṣatī tūṣal kil bait.', 'I hope my platform reaches every home.', 'أتمنى منصتي توصل كل بيت.'), s('atmannā azūr Hondūrās wiyyākum yōm.', 'I hope to visit Honduras with you one day.', 'أتمنى أزور هندوراس وياكم يوم.')]),
  lw('loc_express', 'فخور', 'fakhūr', 'proud', [s('ana fakhūr b-shughlī.', 'I am proud of my work.', 'أنا فخور بشغلي.'), s('fakhūr b-ṭullābī wāyid.', 'I am very proud of my students.', 'فخور بطلابي وايد.')]),
  lw('loc_express', 'متحمس', 'mitḥammis', 'excited', [s('mitḥammis ḥagg il-mashrūʿ il-yidīd.', 'I am excited about the new project.', 'متحمس حق المشروع اليديد.'), s('il-ʿyāl mitḥammsīn ḥagg il-liʿba.', 'The kids are excited about the game.', 'العيال متحمسين حق اللعبة.')]),
  lw('loc_express', 'صعبة شوي', 'ṣaʿba shway', 'a bit hard', [s('il-lahja ṣaʿba shway bass aḥibbhā.', 'The dialect is a bit hard but I love it.', 'اللهجة صعبة شوي بس أحبها.'), s('il-bidāya ṣaʿba shway, ʿugub tiṣīr sahla.', 'The start is a bit hard, later it gets easy.', 'البداية صعبة شوي، عقب تصير سهلة.')]),
  lw('loc_express', 'يستاهل', 'yistāhal', "it's worth it / he deserves it", [s('it-taʿab yistāhal.', 'The effort is worth it.', 'التعب يستاهل.'), s('hal-balad yistāhal kil shay.', 'This country deserves everything.', 'هالبلد يستاهل كل شي.')]),

  // === ⚙️ PALABRAS MOTOR (15) ===
  lw('loc_power', 'الحين', 'il-ḥīn', 'now (THE Emirati "now")', [s('il-ḥīn afham!', 'NOW I understand!', 'الحين أفهم!'), s('ana mashghūl il-ḥīn, akallimk ʿugub.', "I'm busy now, I'll call you later.", 'أنا مشغول الحين، أكلمك عقب.')]),
  lw('loc_power', 'عقب', 'ʿugub', 'after / later (Emirati)', [s('ʿugub il-ijtimāʿ nitgahwā.', 'After the meeting we get coffee.', 'عقب الاجتماع نتقهوى.'), s('khallnā nitkallam ʿugub.', "Let's talk later.", 'خلنا نتكلم عقب.')]),
  lw('loc_power', 'عشان', 'ʿashān', 'because / so that', [s('yīt hnīh ʿashān atʿallam.', 'I came here in order to learn.', 'ييت هنيه عشان أتعلم.'), s('atʿallam ʿarabī ʿashān aḥtirim ith-thaqāfa.', 'I learn Arabic because I respect the culture.', 'أتعلم عربي عشان أحترم الثقافة.')]),
  lw('loc_power', 'لازم', 'lāzim', 'must / have to', [s('lāzim titʿallam il-lahja il-maḥalliyya.', 'You must learn the local dialect.', 'لازم تتعلم اللهجة المحلية.'), s('lāzim arūḥ il-ḥīn.', 'I have to go now.', 'لازم أروح الحين.')]),
  lw('loc_power', 'يمكن', 'yimkin', 'maybe', [s('yimkin ayī bāchir.', 'Maybe I will come tomorrow.', 'يمكن أيي باچر.'), s('yimkin ʿindik ḥagg.', 'Maybe you are right.', 'يمكن عندك حق.')]),
  lw('loc_power', 'وايد', 'wāyid', 'very / a lot (THE Emirati word)', [s('hāda zēn wāyid!', 'This is very good!', 'هذا زين وايد!'), s('ʿindī shughl wāyid il-yōm.', 'I have a lot of work today.', 'عندي شغل وايد اليوم.')]),
  lw('loc_power', 'شوي', 'shway', 'a little / slowly', [s('atkallam ʿarabī shway.', 'I speak a little Arabic.', 'أتكلم عربي شوي.'), s('shway shway, ʿallimnī.', 'Slowly slowly, teach me.', 'شوي شوي، علمني.')]),
  lw('loc_power', 'بس', 'bass', 'only / but / enough', [s('abā wāḥid bass.', 'I want just one.', 'أبا واحد بس.'), s('bass! khalāṣ, fahamt.', 'Enough! Okay, I got it.', 'بس! خلاص، فهمت.')]),
  lw('loc_power', 'عاد', 'ʿād', 'so / then / come on (particle)', [s('lā tinsā ʿād!', "Don't forget, alright!", 'لا تنسى عاد!'), s('shū ʿād hal-akil il-lathīth?!', 'What is this delicious food then?!', 'شو عاد هالأكل اللذيذ؟!')]),
  lw('loc_power', 'چذي', 'chidhī', 'like this (Emirati "ch")', [s('sawwīhā chidhī.', 'Do it like this.', 'سويها چذي.'), s('lēsh chidhī?', 'Why like this?', 'ليش چذي؟')]),
  lw('loc_power', 'مب', 'mub', 'not (Emirati negation)', [s('hāda mub ṣaʿb.', 'This is not hard.', 'هذا مب صعب.'), s('ana mub mashghūl il-ḥīn.', 'I am not busy now.', 'أنا مب مشغول الحين.')]),
  lw('loc_power', 'أروم', 'arūm', 'I can (uniquely Emirati)', [s('arūm asāʿdik.', 'I can help you.', 'أروم أساعدك.'), s('mā arūm ayī bāchir.', "I can't come tomorrow.", 'ما أروم أيي باچر.')]),
  lw('loc_power', 'أبا', 'abā', 'I want (Emirati)', [s('abā atʿallam akthar.', 'I want to learn more.', 'أبا أتعلم أكثر.'), s('shū tabā min il-bagāla?', 'What do you want from the store?', 'شو تبا من البقالة؟')]),
  lw('loc_power', 'مال', 'māl', 'of / belonging to', [s('hāda il-ktāb mālī.', 'This book is mine.', 'هذا الكتاب مالي.'), s('is-sayyāra māl ṣāḥbī.', "The car is my friend's.", 'السيارة مال صاحبي.')]),
  lw('loc_power', 'توني', 'tawnī', 'I just… (this moment)', [s('tawnī wāṣil.', 'I just arrived.', 'توني واصل.'), s('tawnī mkhalliṣ ish-shughl.', 'I just finished work.', 'توني مخلص الشغل.')]),

  // === 🌆 VIDA DIARIA EN DUBÁI (15) ===
  lw('loc_daily', 'كرك', 'karak', 'karak tea (Dubai institution)', [s('chāy karak wāḥid, min faḍlak.', 'One karak tea, please.', 'چاي كرك واحد، من فضلك.'), s('mā fī shay aḥsan min karak iṣ-ṣubḥ.', 'Nothing beats a morning karak.', 'ما في شي أحسن من كرك الصبح.')]),
  lw('loc_daily', 'بقالة', 'bagāla', 'corner store / mini-mart', [s('arūḥ il-bagāla ashtrī māy.', 'I\'m going to the corner store to buy water.', 'أروح البقالة أشتري ماي.'), s('il-bagāla yamm il-bait maftūḥa lēn nuṣṣ il-lail.', 'The corner store next to the house is open until midnight.', 'البقالة يم البيت مفتوحة لين نص الليل.')]),
  lw('loc_daily', 'سوق', 'sūg', 'souq / market', [s('rāḥaw is-sūg yishtarūn hadāyā.', 'They went to the souq to buy gifts.', 'راحوا السوق يشترون هدايا.'), s('sūg il-dhahab fi Dērā mashhūr.', 'The gold souq in Deira is famous.', 'سوق الذهب في ديرة مشهور.')]),
  lw('loc_daily', 'مول', 'mōl', 'mall', [s('nitlāgā fi il-mōl ʿugub il-maghrib.', 'We meet at the mall after sunset prayer.', 'نتلاقى في المول عقب المغرب.'), s('il-mōl zaḥma yōm il-jumʿa.', 'The mall is crowded on Friday.', 'المول زحمة يوم الجمعة.')]),
  lw('loc_daily', 'مترو', 'metrō', 'metro', [s('ākhidh il-metrō ḥagg id-dawām.', 'I take the metro to work.', 'آخذ المترو حق الدوام.'), s('maḥaṭṭat il-metrō yamm il-burj.', 'The metro station is next to the tower.', 'محطة المترو يم البرج.')]),
  lw('loc_daily', 'سيدا', 'sīdā', 'straight ahead', [s('rūḥ sīdā baʿdēn liff yamīn.', 'Go straight then turn right.', 'روح سيدا بعدين لف يمين.'), s('il-maṭʿam sīdā, mub baʿīd.', 'The restaurant is straight ahead, not far.', 'المطعم سيدا، مب بعيد.')]),
  lw('loc_daily', 'يم', 'yamm', 'next to (Emirati)', [s('il-madrasa yamm il-masyid.', 'The school is next to the mosque.', 'المدرسة يم المسيد.'), s('agʿad yammī, khalna nitkallam.', 'Sit next to me, let\'s talk.', 'اقعد يمي، خلنا نتكلم.')]),
  lw('loc_daily', 'حر', 'ḥarr', 'hot (the famous Gulf heat)', [s('il-yōm ḥarr wāyid, khalna dākhil.', "Today is very hot, let's stay inside.", 'اليوم حر وايد، خلنا داخل.'), s('fi iṣ-ṣaif il-ḥarr mā yinḥamal.', 'In summer the heat is unbearable.', 'في الصيف الحر ما ينحمل.')]),
  lw('loc_daily', 'رطوبة', 'ruṭūba', 'humidity', [s('ir-ruṭūba fi aghusṭus shay thānī!', 'The humidity in August is something else!', 'الرطوبة في أغسطس شي ثاني!'), s('ḥarr w ruṭūba — yalla lil-mōl!', 'Heat and humidity — off to the mall!', 'حر ورطوبة — يلا للمول!')]),
  lw('loc_daily', 'الويكند', 'il-wīkand', 'the weekend', [s('shū msawwī fi il-wīkand?', 'What are you doing on the weekend?', 'شو مسوي في الويكند؟'), s('il-wīkand nirūḥ il-baḥar.', 'On the weekend we go to the beach.', 'الويكند نروح البحر.')]),
  lw('loc_daily', 'دوام', 'dawām', 'work hours / shift', [s('dawāmī min thamān lēn arbaʿ.', 'My work hours are from eight to four.', 'دوامي من ثمان لين أربع.'), s('ʿugub id-dawām nitgahwā.', 'After work we grab coffee.', 'عقب الدوام نتقهوى.')]),
  lw('loc_daily', 'لين', 'lēn', 'until (Emirati)', [s('ashtaghil lēn il-maghrib.', 'I work until sunset.', 'أشتغل لين المغرب.'), s('intiẓart lēn is-sāʿa ʿashra.', 'I waited until ten o\'clock.', 'انتظرت لين الساعة عشرة.')]),
  lw('loc_daily', 'زحمة', 'zaḥma', 'traffic / crowded', [s('iṭ-ṭarīg zaḥma il-ḥīn.', 'The road is jammed right now.', 'الطريق زحمة الحين.'), s('shēkh Zāyid rōd zaḥma iṣ-ṣubḥ.', 'Sheikh Zayed Road is jammed in the morning.', 'شيخ زايد رود زحمة الصبح.')]),
  lw('loc_daily', 'ريوق', 'rayūg', 'breakfast (uniquely Emirati)', [s('shū rayūgik il-yōm?', 'What\'s your breakfast today?', 'شو ريوقك اليوم؟'), s('rayūgnā chabāb w karak.', 'Our breakfast is chebab pancakes and karak.', 'ريوقنا چباب وكرك.')]),
  lw('loc_daily', 'مسيد', 'masyid', 'mosque (Emirati for masjid)', [s('il-masyid yamm baitnā.', 'The mosque is next to our house.', 'المسيد يم بيتنا.'), s('asmaʿ il-adhān min il-masyid.', 'I hear the call to prayer from the mosque.', 'أسمع الأذان من المسيد.')]),
];
EMIRATI_WORDS.push(...EMIRATI_LOCAL_WORDS);

// ═════════════════════════════════════════════════════════════════════
// 🇦🇪 LOCAL TRANCHE 2 (loc101-loc200) — 2026-07-06. Fernando's request:
// "I need 1,000 not 100 — my topics: am I saying it right / correct me;
// I love Emaar and Mohammed Alabbar and his story, he speaks with so
// much passion; the respect and gratitude I have for the UAE for the
// opportunities given; I'm an edtech founder pushing for the kids and
// bridging worlds and cultures; I want kids to know the wonders of
// Dubai." The lw() counter continues → ids loc101+ (never collide).
// ═════════════════════════════════════════════════════════════════════
const EMIRATI_LOCAL2 = [
  // === 🔁 CORRÍGEME — aprender hablando (15) ===
  lw('loc_correct', 'صح چذي؟', 'ṣaḥḥ chidhī?', 'is it right like this?', [s('gilt-hā ṣaḥḥ chidhī?', 'Did I say it right like this?', 'قلتها صح چذي؟'), s('ṣaḥḥ chidhī, willā ghalaṭ?', 'Right like this, or wrong?', 'صح چذي، ولّا غلط؟')]),
  lw('loc_correct', 'صلحني لو غلطان', 'ṣalliḥnī lō ghalṭān', 'correct me if I am wrong', [s('ṣalliḥnī lō ghalṭān, tarā abā atʿallam.', 'Correct me if I am wrong — I really want to learn.', 'صلحني لو غلطان، ترى أبا أتعلم.'), s('lō gilt shay ghalaṭ, ṣalliḥnī ʿalā ṭūl.', 'If I say something wrong, correct me right away.', 'لو قلت شي غلط، صلحني على طول.')]),
  lw('loc_correct', 'شلون أقول', 'shlōn agūl…?', 'how do I say…?', [s('shlōn agūl hāy bil-imārātī?', 'How do I say this in Emirati?', 'شلون أقول هاي بالإماراتي؟'), s('shlōn agūl "thank you" bil-lahja?', 'How do I say "thank you" in the dialect?', 'شلون أقول "thank you" باللهجة؟')]),
  lw('loc_correct', 'شو معنى', 'shū maʿnā…?', 'what does … mean?', [s('shū maʿnā hal-kilma?', 'What does this word mean?', 'شو معنى هالكلمة؟'), s('shū maʿnā "wāyid"?', 'What does "wāyid" mean?', 'شو معنى "وايد"؟')]),
  lw('loc_correct', 'عيد مرة ثانية', 'ʿīd marra thānya', 'say it again', [s('mumkin tʿīd marra thānya?', 'Could you say it again?', 'ممكن تعيد مرة ثانية؟'), s('ʿīd-hā shway abṭaʾ, min faḍlak.', 'Say it a bit slower, please.', 'عيدها شوي أبطأ، من فضلك.')]),
  lw('loc_correct', 'ما فهمت', 'mā fihamt', "I didn't understand", [s('āsif, mā fihamt — ʿīd lō samaḥt.', "Sorry, I didn't understand — repeat please.", 'آسف، ما فهمت — عيد لو سمحت.'), s('mā fihamt il-kilma il-akhīra.', "I didn't catch the last word.", 'ما فهمت الكلمة الأخيرة.')]),
  lw('loc_correct', 'فهمت عليك', 'fihamt ʿalaik', 'I got you / understood you', [s('il-ḥīn fihamt ʿalaik!', 'NOW I got you!', 'الحين فهمت عليك!'), s('fihamt ʿalaik, kalāmik wāḍiḥ.', 'I understood you, your words are clear.', 'فهمت عليك، كلامك واضح.')]),
  lw('loc_correct', 'نطقي زين؟', 'nuṭqī zēn?', 'is my pronunciation good?', [s('nuṭqī zēn willā aḥtāj atmarran?', 'Is my pronunciation good or do I need practice?', 'نطقي زين ولّا أحتاج أتمرن؟'), s('gūl lī iṣ-ṣij: nuṭqī zēn?', 'Tell me the truth: is my pronunciation good?', 'قول لي الصج: نطقي زين؟')]),
  lw('loc_correct', 'علمني', 'ʿallimnī', 'teach me', [s('ʿallimnī kilma yidīda kil yōm.', 'Teach me a new word every day.', 'علمني كلمة يديدة كل يوم.'), s('ʿallimnī shlōn akūn maḥallī akthar.', 'Teach me how to sound more local.', 'علمني شلون أكون محلي أكثر.')]),
  lw('loc_correct', 'أتمرن', 'atmarran', 'I practice', [s('atmarran ʿarabī kil yōm nuṣṣ sāʿa.', 'I practice Arabic half an hour every day.', 'أتمرن عربي كل يوم نص ساعة.'), s('lāzim atmarran wiyya nās maḥalliyīn.', 'I need to practice with local people.', 'لازم أتمرن ويا ناس محليين.')]),
  lw('loc_correct', 'أستخدمها صح؟', 'astakhdimhā ṣaḥḥ?', 'am I using it right?', [s('astakhdim hal-kilma ṣaḥḥ?', 'Am I using this word correctly?', 'أستخدم هالكلمة صح؟'), s('gūl lī lō astakhdimhā ghalaṭ.', 'Tell me if I use it wrong.', 'قول لي لو أستخدمها غلط.')]),
  lw('loc_correct', 'يعني', 'yaʿnī', 'meaning / that is', [s('yaʿnī shū bil-ḍabṭ?', 'Meaning what exactly?', 'يعني شو بالضبط؟'), s('hal-kilma yaʿnī "happy", ṣaḥḥ?', 'This word means "happy", right?', 'هالكلمة يعني "happy"، صح؟')]),
  lw('loc_correct', 'بالضبط', 'bil-ḍabṭ', 'exactly', [s('chidhī bil-ḍabṭ!', 'Exactly like this!', 'چذي بالضبط!'), s('shū tagṣid bil-ḍabṭ?', 'What do you mean exactly?', 'شو تقصد بالضبط؟')]),
  lw('loc_correct', 'باقي علي وايد', 'bāgī ʿalayy wāyid', 'I still have a long way to go', [s('mashkūr, bass bāgī ʿalayy wāyid.', 'Thanks, but I still have a long way to go.', 'مشكور، بس باقي عليّ وايد.'), s('ʿarabī yitḥassan, bass bāgī ʿalayy wāyid.', 'My Arabic is improving, but there is still a lot left.', 'عربي يتحسن، بس باقي عليّ وايد.')]),
  lw('loc_correct', 'كلمة كلمة', 'kilma kilma', 'word by word', [s('atʿallam kilma kilma, yōm ʿugub yōm.', 'I learn word by word, day after day.', 'أتعلم كلمة كلمة، يوم عقب يوم.'), s('tarjim lī kilma kilma.', 'Translate it for me word by word.', 'ترجم لي كلمة كلمة.')]),

  // === 🏗️ EMAAR, ALABBAR E INSPIRACIÓN (15) ===
  lw('loc_emaar', 'إعمار', 'Iʿmār', 'Emaar', [s('aḥibb qiṣṣat Iʿmār min il-bidāya.', 'I love the Emaar story from the beginning.', 'أحب قصة إعمار من البداية.'), s('Iʿmār ghayyarat shakil Dubay.', 'Emaar changed the face of Dubai.', 'إعمار غيرت شكل دبي.')]),
  lw('loc_emaar', 'محمد العبار', 'Moḥammad il-ʿAbbār', 'Mohamed Alabbar', [s('Moḥammad il-ʿAbbār qudwa lī.', 'Mohamed Alabbar is a role model for me.', 'محمد العبار قدوة لي.'), s('il-ʿAbbār yitkallam b-shaghaf ʿajīb.', 'Alabbar speaks with amazing passion.', 'العبار يتكلم بشغف عجيب.')]),
  lw('loc_emaar', 'قدوة', 'qudwa', 'role model', [s('il-ʿAbbār qudwa ḥagg kil rāʾid aʿmāl.', 'Alabbar is a role model for every entrepreneur.', 'العبار قدوة حق كل رائد أعمال.'), s('adawwir qudwa fi kil majāl.', 'I look for a role model in every field.', 'أدور قدوة في كل مجال.')]),
  lw('loc_emaar', 'شغف', 'shaghaf', 'passion', [s('yitkallam b-shaghaf, w hāda illī yifrig.', 'He speaks with passion, and that is what makes the difference.', 'يتكلم بشغف، وهذا اللي يفرق.'), s('ish-shaghaf huwa sirr in-najāḥ.', 'Passion is the secret of success.', 'الشغف هو سر النجاح.')]),
  lw('loc_emaar', 'رؤية', 'ruʾya', 'vision', [s('ruʾyat Dubay dāyman lil-mustaqbal.', "Dubai's vision is always toward the future.", 'رؤية دبي دايما للمستقبل.'), s('ʿindī ruʾya wāḍḥa l-minaṣṣatī.', 'I have a clear vision for my platform.', 'عندي رؤية واضحة لمنصتي.')]),
  lw('loc_emaar', 'برج خليفة', 'Burj Khalīfa', 'Burj Khalifa', [s('Burj Khalīfa mub bass burj — huwa risāla.', 'Burj Khalifa is not just a tower — it is a message.', 'برج خليفة مب بس برج — هو رسالة.'), s('min fōg Burj Khalīfa, tshūf inn il-mustaḥīl mumkin.', 'From the top of Burj Khalifa you see the impossible is possible.', 'من فوق برج خليفة، تشوف إن المستحيل ممكن.')]),
  lw('loc_emaar', 'دبي مول', 'Dubay Mōl', 'Dubai Mall', [s('Dubay Mōl akbar mōl fi il-ʿālam.', 'Dubai Mall is the biggest mall in the world.', 'دبي مول أكبر مول في العالم.'), s('il-ʿyāl yinbahrūn b-Dubay Mōl.', 'The kids are amazed by Dubai Mall.', 'العيال ينبهرون بدبي مول.')]),
  lw('loc_emaar', 'من الصفر', 'min iṣ-ṣifir', 'from zero', [s('badā min iṣ-ṣifir w waṣal lil-gimma.', 'He started from zero and reached the top.', 'بدا من الصفر ووصل للقمة.'), s('ana baʿad badait min iṣ-ṣifir.', 'I too started from zero.', 'أنا بعد بديت من الصفر.')]),
  lw('loc_emaar', 'قصة نجاح', 'qiṣṣat najāḥ', 'success story', [s('qiṣṣat najāḥ il-ʿAbbār tulhimnī.', "Alabbar's success story inspires me.", 'قصة نجاح العبار تلهمني.'), s('abā asawwī qiṣṣat najāḥ mālitī.', 'I want to make my own success story.', 'أبا أسوي قصة نجاح مالتي.')]),
  lw('loc_emaar', 'طموح', 'ṭumūḥ', 'ambition', [s('iṭ-ṭumūḥ mā lah ḥudūd fi Dubay.', 'Ambition has no limits in Dubai.', 'الطموح ما له حدود في دبي.'), s('ṭumūḥī akbar min it-taḥaddiyāt.', 'My ambition is bigger than the challenges.', 'طموحي أكبر من التحديات.')]),
  lw('loc_emaar', 'يلهمني', 'yulhimnī', 'it inspires me', [s('hal-balad yulhimnī kil yōm.', 'This country inspires me every day.', 'هالبلد يلهمني كل يوم.'), s('kalām il-ʿAbbār yulhimnī.', "Alabbar's words inspire me.", 'كلام العبار يلهمني.')]),
  lw('loc_emaar', 'رائد أعمال', 'rāʾid aʿmāl', 'entrepreneur', [s('ana rāʾid aʿmāl fi majāl it-taʿlīm.', 'I am an entrepreneur in education.', 'أنا رائد أعمال في مجال التعليم.'), s('Dubay jannat ruwwād il-aʿmāl.', 'Dubai is the paradise of entrepreneurs.', 'دبي جنة رواد الأعمال.')]),
  lw('loc_emaar', 'المستحيل ممكن', 'il-mustaḥīl mumkin', 'the impossible is possible', [s('fi Dubay, il-mustaḥīl mumkin.', 'In Dubai, the impossible is possible.', 'في دبي، المستحيل ممكن.'), s('ʿallamatnī Dubay inn il-mustaḥīl mumkin.', 'Dubai taught me the impossible is possible.', 'علمتني دبي إن المستحيل ممكن.')]),
  lw('loc_emaar', 'يفكر كبير', 'yfakkir kbīr', 'thinks big', [s('hnīh in-nās tfakkir kbīr.', 'Here people think big.', 'هنيه الناس تفكر كبير.'), s('lāzim tfakkir kbīr mithl il-ʿAbbār.', 'You must think big like Alabbar.', 'لازم تفكر كبير مثل العبار.')]),
  lw('loc_emaar', 'إنجاز', 'injāz', 'achievement', [s('kil burj hnīh injāz.', 'Every tower here is an achievement.', 'كل برج هنيه إنجاز.'), s('aftakhir b-kil injāz ṣghīr.', 'I take pride in every small achievement.', 'أفتخر بكل إنجاز صغير.')]),

  // === 🇦🇪 GRATITUD Y RESPETO AL UAE (15) ===
  lw('loc_grateful', 'ممتن', 'mumtann', 'grateful', [s('ana mumtann wāyid l-hal-balad.', 'I am very grateful to this country.', 'أنا ممتن وايد لهالبلد.'), s('mumtann l-kil furṣa inʿaṭat lī.', 'Grateful for every opportunity given to me.', 'ممتن لكل فرصة انعطت لي.')]),
  lw('loc_grateful', 'فرصة', 'furṣa', 'opportunity', [s('il-Imārāt ʿaṭatnī furṣat ʿumrī.', 'The Emirates gave me the opportunity of my life.', 'الإمارات عطتني فرصة عمري.'), s('hnīh il-furaṣ ḥagg illī yishtaghil.', 'Here the opportunities belong to those who work.', 'هنيه الفرص حق اللي يشتغل.')]),
  lw('loc_grateful', 'احترام', 'iḥtirām', 'respect', [s('ʿindī iḥtirām kbīr l-hal-balad w ahlah.', 'I have great respect for this country and its people.', 'عندي احترام كبير لهالبلد وأهله.'), s('il-iḥtirām mutabādal bainnā.', 'The respect between us is mutual.', 'الاحترام متبادل بيننا.')]),
  lw('loc_grateful', 'بيتي الثاني', 'baitī il-thānī', 'my second home', [s('il-Imārāt ṣārat baitī il-thānī.', 'The Emirates became my second home.', 'الإمارات صارت بيتي الثاني.'), s('Hondūrās baitī il-awwal, w Dubay baitī il-thānī.', 'Honduras is my first home, and Dubai my second.', 'هندوراس بيتي الأول، ودبي بيتي الثاني.')]),
  lw('loc_grateful', 'أمان', 'amān', 'safety', [s('il-amān hnīh shay mā tḥaṣṣlah b-kil makān.', 'The safety here is something you do not find everywhere.', 'الأمان هنيه شي ما تحصله بكل مكان.'), s('ʿyālnā yiʿīshūn b-amān hnīh.', 'Our kids live in safety here.', 'عيالنا يعيشون بأمان هنيه.')]),
  lw('loc_grateful', 'تسامح', 'tasāmuḥ', 'tolerance', [s('il-Imārāt balad it-tasāmuḥ.', 'The Emirates is the country of tolerance.', 'الإمارات بلد التسامح.'), s('hnīh kil il-jinsiyyāt tiʿīsh b-tasāmuḥ.', 'Here all nationalities live in tolerance.', 'هنيه كل الجنسيات تعيش بتسامح.')]),
  lw('loc_grateful', 'كرم', 'karam', 'generosity', [s('karam il-imārātiyīn mashhūr.', 'The generosity of Emiratis is famous.', 'كرم الإماراتيين مشهور.'), s('shift il-karam b-ʿainī hnīh.', 'I saw the generosity with my own eyes here.', 'شفت الكرم بعيني هنيه.')]),
  lw('loc_grateful', 'الشيوخ', 'ish-shuyūkh', 'the sheikhs / the leaders', [s('ruʾyat ish-shuyūkh sawwat kil hāda.', "The sheikhs' vision made all of this.", 'رؤية الشيوخ سوت كل هذا.'), s('ish-shuyūkh yhtammūn bit-taʿlīm wāyid.', 'The sheikhs care a lot about education.', 'الشيوخ يهتمون بالتعليم وايد.')]),
  lw('loc_grateful', 'زايد', 'Zāyed', 'Sheikh Zayed', [s('ish-Shaikh Zāyed abu il-Imārāt.', 'Sheikh Zayed is the father of the Emirates.', 'الشيخ زايد أبو الإمارات.'), s('qiṣṣat Zāyed tistāhal tinḥachā lil-ʿyāl.', "Zayed's story deserves to be told to the kids.", 'قصة زايد تستاهل تنحچى للعيال.')]),
  lw('loc_grateful', 'أرد الجميل', 'arudd il-jamīl', 'repay the kindness', [s('abā arudd il-jamīl l-hal-balad.', 'I want to repay the kindness to this country.', 'أبا أرد الجميل لهالبلد.'), s('ashtaghil ʿashān arudd il-jamīl.', 'I work in order to repay the kindness.', 'أشتغل عشان أرد الجميل.')]),
  lw('loc_grateful', 'أخدم المجتمع', 'akhdim il-mujtamaʿ', 'serve the community', [s('abā akhdim il-mujtamaʿ b-illī aʿrfah: it-taʿlīm.', 'I want to serve the community with what I know: education.', 'أبا أخدم المجتمع باللي أعرفه: التعليم.'), s('akhdim il-mujtamaʿ ʿan ṭarīq il-ʿyāl.', 'I serve the community through the kids.', 'أخدم المجتمع عن طريق العيال.')]),
  lw('loc_grateful', 'ما أنسى', 'mā ansā', 'I will not forget', [s('mā ansā illī sawwatah lī hal-balad.', 'I will not forget what this country did for me.', 'ما أنسى اللي سوته لي هالبلد.'), s('mā ansā awwal yōm lī fi Dubay.', 'I will never forget my first day in Dubai.', 'ما أنسى أول يوم لي في دبي.')]),
  lw('loc_grateful', 'توفيق', 'tawfīq', 'success / divine blessing', [s('allāh yaʿṭīkum it-tawfīq.', 'May God grant you success.', 'الله يعطيكم التوفيق.'), s('b-tawfīq allāh, kil shay ṣār.', "With God's blessing, everything happened.", 'بتوفيق الله، كل شي صار.')]),
  lw('loc_grateful', 'ترحيب', 'tarḥīb', 'welcome (the one you receive)', [s('it-tarḥīb illī ligītah hnīh mā shiftah b-makān thānī.', 'The welcome I found here I never saw anywhere else.', 'الترحيب اللي لقيته هنيه ما شفته بمكان ثاني.'), s('tarḥīb in-nās hnīh min il-galb.', "People's welcome here is from the heart.", 'ترحيب الناس هنيه من القلب.')]),
  lw('loc_grateful', 'دار زايد', 'dār Zāyed', "Zayed's home (loving name for UAE)", [s('hāy dār Zāyed — il-khair fīhā dāyim.', "This is Zayed's home — goodness lives here always.", 'هاي دار زايد — الخير فيها دايم.'), s('fi dār Zāyed, il-gharīb mā yiḥiss gharīb.', "In Zayed's home, the stranger never feels a stranger.", 'في دار زايد، الغريب ما يحس غريب.')]),

  // === 🚀 MI MISIÓN EDTECH (20) ===
  lw('loc_founder', 'مؤسس', 'muʾassis', 'founder', [s('ana muʾassis minaṣṣa taʿlīmiyya.', 'I am the founder of an educational platform.', 'أنا مؤسس منصة تعليمية.'), s('il-muʾassis lāzim yiḥibb illī ysawwīh.', 'A founder must love what he does.', 'المؤسس لازم يحب اللي يسويه.')]),
  lw('loc_founder', 'رسالتي', 'risālatī', 'my mission', [s('risālatī arbiṭ il-ʿawālim bil-lugha.', 'My mission is to connect worlds through language.', 'رسالتي أربط العوالم باللغة.'), s('risālatī: kil ṭifil yitʿallam w huwa mistānis.', 'My mission: every child learns while having fun.', 'رسالتي: كل طفل يتعلم وهو مستانس.')]),
  lw('loc_founder', 'أبني جسور', 'abnī jusūr', 'I build bridges', [s('abnī jusūr bain iṣ-Ṣīn wil-Imārāt w Amrīkā il-lātīniyya.', 'I build bridges between China, the Emirates and Latin America.', 'أبني جسور بين الصين والإمارات وأمريكا اللاتينية.'), s('il-lugha ajmal jisr bain ith-thaqāfāt.', 'Language is the most beautiful bridge between cultures.', 'اللغة أجمل جسر بين الثقافات.')]),
  lw('loc_founder', 'تقنية', 'taqniya', 'technology', [s('astakhdim it-taqniya ʿashān it-taʿlīm yiṣīr laʿba.', 'I use technology so learning becomes a game.', 'أستخدم التقنية عشان التعليم يصير لعبة.'), s('it-taqniya b-dūn tarbiya mā tiswā.', 'Technology without upbringing is worth nothing.', 'التقنية بدون تربية ما تسوى.')]),
  lw('loc_founder', 'مستقبل', 'mustaqbal', 'future', [s('il-ʿyāl hum il-mustaqbal.', 'The kids ARE the future.', 'العيال هم المستقبل.'), s('nabnī il-mustaqbal ṣaff ṣaff.', 'We build the future classroom by classroom.', 'نبني المستقبل صف صف.')]),
  lw('loc_founder', 'جيل', 'yīl', 'generation (Emirati "y")', [s('hal-yīl yitʿallam b-ṭarīqa mukhtalifa.', 'This generation learns in a different way.', 'هالجيل يتعلم بطريقة مختلفة.'), s('abā asāʿid yīl kāmil yiḥibb il-lughāt.', 'I want to help a whole generation love languages.', 'أبا أساعد جيل كامل يحب اللغات.')]),
  lw('loc_founder', 'أؤمن إن', 'uʾmin inn', 'I believe that', [s('uʾmin inn il-laʿib aqwā muʿallim.', 'I believe play is the strongest teacher.', 'أؤمن إن اللعب أقوى معلم.'), s('uʾmin inn kil ṭifil ʿindah mawhiba.', 'I believe every child has a talent.', 'أؤمن إن كل طفل عنده موهبة.')]),
  lw('loc_founder', 'قضيتي', 'qaḍiyyatī', 'my cause', [s('qaḍiyyatī it-taʿlīm il-mumtiʿ.', 'My cause is joyful education.', 'قضيتي التعليم الممتع.'), s('hāy mub tijāra bass — hāy qaḍiyyatī.', 'This is not just business — this is my cause.', 'هاي مب تجارة بس — هاي قضيتي.')]),
  lw('loc_founder', 'شغلي مب وظيفة', 'shughlī mub waẓīfa', 'my work is not a job', [s('shughlī mub waẓīfa — huwa risāla.', 'My work is not a job — it is a mission.', 'شغلي مب وظيفة — هو رسالة.'), s('lamma tḥibb shughlak, mub waẓīfa baʿad.', 'When you love your work, it is no longer a job.', 'لما تحب شغلك، مب وظيفة بعد.')]),
  lw('loc_founder', 'ثقافات', 'thaqāfāt', 'cultures', [s('arbiṭ thalāth thaqāfāt fi minaṣṣa waḥda.', 'I connect three cultures in one platform.', 'أربط ثلاث ثقافات في منصة وحدة.'), s('il-ʿyāl yitʿallamūn iḥtirām ith-thaqāfāt.', 'The kids learn to respect cultures.', 'العيال يتعلمون احترام الثقافات.')]),
  lw('loc_founder', 'حدود', 'ḥudūd', 'borders / limits', [s('it-taʿlīm mā lah ḥudūd.', 'Education has no borders.', 'التعليم ما له حدود.'), s('minaṣṣatī tʿabbir il-ḥudūd.', 'My platform crosses borders.', 'منصتي تعبر الحدود.')]),
  lw('loc_founder', 'الماندرين', 'il-māndarīn', 'Mandarin', [s('aʿallim il-māndarīn li-ʿyāl il-khalīj.', 'I teach Mandarin to Gulf kids.', 'أعلم المندرين لعيال الخليج.'), s('il-māndarīn lughat il-mustaqbal it-tijārī.', 'Mandarin is the language of the commercial future.', 'المندرين لغة المستقبل التجاري.')]),
  lw('loc_founder', 'ألعاب تعليمية', 'alʿāb taʿlīmiyya', 'educational games', [s('asawwī alʿāb taʿlīmiyya b-rūḥī.', 'I build educational games myself.', 'أسوي ألعاب تعليمية بروحي.'), s('il-alʿāb it-taʿlīmiyya tkhallī iṭ-ṭifil yansā innah yidris.', 'Educational games make the child forget he is studying.', 'الألعاب التعليمية تخلي الطفل ينسى إنه يدرس.')]),
  lw('loc_founder', 'صف', 'ṣaff', 'classroom', [s('ṣaffī malyān ḍaḥik w taʿallum.', 'My classroom is full of laughter and learning.', 'صفي مليان ضحك وتعلم.'), s('kil ṣaff ʿindah rūḥ.', 'Every classroom has a soul.', 'كل صف عنده روح.')]),
  lw('loc_founder', 'طلابي', 'ṭullābī', 'my students', [s('ṭullābī min kil il-ʿālam.', 'My students are from all over the world.', 'طلابي من كل العالم.'), s('afraḥ lamma ṭullābī yinjaḥūn.', 'I rejoice when my students succeed.', 'أفرح لما طلابي ينجحون.')]),
  lw('loc_founder', 'نتيجة', 'natīja', 'result', [s('in-natāyij titkallam ʿan nafs-hā.', 'The results speak for themselves.', 'النتايج تتكلم عن نفسها.'), s('shift natīja ʿajība fi awwal shahar.', 'I saw an amazing result in the first month.', 'شفت نتيجة عجيبة في أول شهر.')]),
  lw('loc_founder', 'حل', 'ḥall', 'solution', [s('ʿindī ḥall l-mushkilat il-malal fi iṣ-ṣaff.', 'I have a solution for boredom in the classroom.', 'عندي حل لمشكلة الملل في الصف.'), s('kil mushkila l-hā ḥall.', 'Every problem has a solution.', 'كل مشكلة لها حل.')]),
  lw('loc_founder', 'فريق', 'farīq', 'team', [s('abnī farīq shway shway.', 'I am building a team little by little.', 'أبني فريق شوي شوي.'), s('il-farīq ṣghīr bass il-ḥilm kbīr.', 'The team is small but the dream is big.', 'الفريق صغير بس الحلم كبير.')]),
  lw('loc_founder', 'أطور', 'aṭawwir', 'I develop / improve', [s('aṭawwir il-minaṣṣa kil yōm.', 'I improve the platform every day.', 'أطور المنصة كل يوم.'), s('aṭawwir nafsī gabl kil shay.', 'I develop myself before anything else.', 'أطور نفسي قبل كل شي.')]),
  lw('loc_founder', 'إرث', 'irth', 'legacy', [s('abā atrik irth yifīd il-ʿyāl.', 'I want to leave a legacy that benefits the kids.', 'أبا أترك إرث يفيد العيال.'), s('il-irth il-ḥaqīqī huwa illī tizraʿah fi in-nās.', 'The real legacy is what you plant in people.', 'الإرث الحقيقي هو اللي تزرعه في الناس.')]),

  // === ✨ MARAVILLAS DE DUBÁI (15) ===
  lw('loc_wonders', 'عجائب', 'ʿajāyib', 'wonders', [s('Dubay malyāna ʿajāyib.', 'Dubai is full of wonders.', 'دبي مليانة عجايب.'), s('abā il-ʿyāl yiʿarfūn ʿajāyib hal-balad.', 'I want the kids to know the wonders of this country.', 'أبا العيال يعرفون عجايب هالبلد.')]),
  lw('loc_wonders', 'نافورة دبي', 'nāfūrat Dubay', 'Dubai Fountain', [s('nāfūrat Dubay tirguṣ ʿala il-mūsīqā.', 'The Dubai Fountain dances to the music.', 'نافورة دبي ترقص على الموسيقى.'), s('il-ʿyāl yinbahrūn bin-nāfūra.', 'The kids are amazed by the fountain.', 'العيال ينبهرون بالنافورة.')]),
  lw('loc_wonders', 'متحف المستقبل', 'matḥaf il-mustaqbal', 'Museum of the Future', [s('matḥaf il-mustaqbal aḥlā mabnā shiftah.', 'The Museum of the Future is the most beautiful building I have seen.', 'متحف المستقبل أحلى مبنى شفته.'), s('ākhidh ṭullābī lil-matḥaf yōm, inshallah.', 'I will take my students to the museum one day, God willing.', 'آخذ طلابي للمتحف يوم، إن شاء الله.')]),
  lw('loc_wonders', 'الصحراء', 'iṣ-ṣaḥrā', 'the desert', [s('iṣ-ṣaḥrā ʿindhā sikūn ʿajīb.', 'The desert has an amazing stillness.', 'الصحرا عندها سكون عجيب.'), s('riḥlat iṣ-ṣaḥrā tijruba mā tinnasā.', 'A desert trip is an unforgettable experience.', 'رحلة الصحرا تجربة ما تنسى.')]),
  lw('loc_wonders', 'كشتة', 'kashta', 'desert outing (Gulf classic)', [s('il-kashta fi il-bard aḥlā shay.', 'A desert outing in the cool season is the best thing.', 'الكشتة في البرد أحلى شي.'), s('yalla kashta hal-wīkand?', 'Shall we go camping this weekend?', 'يلا كشتة هالويكند؟')]),
  lw('loc_wonders', 'مرسى دبي', 'Marsā Dubay', 'Dubai Marina', [s('Marsā Dubay ḥilwa bil-lail.', 'Dubai Marina is beautiful at night.', 'مرسى دبي حلوة بالليل.'), s('nitmashsha fi il-marsā ʿugub il-ʿasha.', 'We stroll in the Marina after dinner.', 'نتمشى في المرسى عقب العشا.')]),
  lw('loc_wonders', 'برواز دبي', 'Birwāz Dubay', 'Dubai Frame', [s('min Birwāz Dubay tshūf il-madīna kilhā.', 'From the Dubai Frame you see the whole city.', 'من برواز دبي تشوف المدينة كلها.'), s('il-birwāz yirbiṭ il-māḍī bil-mustaqbal.', 'The Frame connects the past with the future.', 'البرواز يربط الماضي بالمستقبل.')]),
  lw('loc_wonders', 'جزيرة النخلة', 'yazīrat in-nakhla', 'Palm Jumeirah', [s('in-nakhla muʿjiza handasiyya.', 'The Palm is an engineering miracle.', 'النخلة معجزة هندسية.'), s('shift in-nakhla min iṭ-ṭayyāra?', 'Have you seen the Palm from the plane?', 'شفت النخلة من الطيارة؟')]),
  lw('loc_wonders', 'عين دبي', 'ʿAin Dubay', 'Ain Dubai (the wheel)', [s('ʿAin Dubay akbar ʿajala fi il-ʿālam.', 'Ain Dubai is the biggest wheel in the world.', 'عين دبي أكبر عجلة في العالم.'), s('min fōg, Dubay tbayyin mithl il-khayāl.', 'From up there, Dubai looks like a dream.', 'من فوق، دبي تبين مثل الخيال.')]),
  lw('loc_wonders', 'تراث', 'turāth', 'heritage', [s('it-turāth hnīh maḥfūẓ w ḥayy.', 'The heritage here is preserved and alive.', 'التراث هنيه محفوظ وحي.'), s('aʿallim ṭullābī yiḥtarmūn it-turāth.', 'I teach my students to respect heritage.', 'أعلم طلابي يحترمون التراث.')]),
  lw('loc_wonders', 'سوق الذهب', 'sūg il-dhahab', 'the Gold Souq', [s('sūg il-dhahab yilmaʿ mithl il-khayāl.', 'The Gold Souq shines like a dream.', 'سوق الذهب يلمع مثل الخيال.'), s('khudh il-ʿyāl lis-sūg il-qadīm.', 'Take the kids to the old souq.', 'خذ العيال للسوق القديم.')]),
  lw('loc_wonders', 'العبرة', 'il-ʿabra', 'the abra (creek boat)', [s('irkab il-ʿabra b-dirhamēn bass!', 'Ride the abra for just two dirhams!', 'اركب العبرة بدرهمين بس!'), s('il-ʿabra arkhaṣ w aḥlā jawla fi Dubay.', 'The abra is the cheapest and loveliest ride in Dubai.', 'العبرة أرخص وأحلى جولة في دبي.')]),
  lw('loc_wonders', 'مهرجان', 'mahrajān', 'festival', [s('mahrajānāt Dubay ṭūl is-sana.', 'Dubai has festivals all year long.', 'مهرجانات دبي طول السنة.'), s('il-ʿyāl yiḥibbūn il-mahrajānāt.', 'The kids love the festivals.', 'العيال يحبون المهرجانات.')]),
  lw('loc_wonders', 'حديقة الزهور', 'ḥadīqat il-zuhūr', 'Miracle Garden', [s('ḥadīqat il-zuhūr mithl il-aḥlām.', 'The Miracle Garden is like a dream.', 'حديقة الزهور مثل الأحلام.'), s('ṣawwart il-ʿyāl fi ḥadīqat il-zuhūr.', 'I photographed the kids at the Miracle Garden.', 'صورت العيال في حديقة الزهور.')]),
  lw('loc_wonders', 'تخيل', 'tkhayyal', 'imagine!', [s('tkhayyal: kil hāda kān ṣaḥrā gabl khamsīn sana!', 'Imagine: all this was desert fifty years ago!', 'تخيل: كل هذا كان صحرا قبل خمسين سنة!'), s('tkhayyal shū bysīr baʿad ʿishrīn sana!', 'Imagine what will happen in twenty years!', 'تخيل شو بيصير بعد عشرين سنة!')]),

  // === 🫀 CONVERSACIÓN CON ALMA (20) ===
  lw('loc_deep', 'خذ راحتك', 'khudh rāḥtak', 'take your time / be at ease', [s('khudh rāḥtak, mā fī ʿajala.', 'Take your time, there is no rush.', 'خذ راحتك، ما في عجلة.'), s('tfaḍḍal, khudh rāḥtak fi il-majlis.', 'Please, make yourself at home in the majlis.', 'تفضل، خذ راحتك في المجلس.')]),
  lw('loc_deep', 'من قلبي', 'min galbī', 'from my heart', [s('agūlhā min galbī: mashkūrīn.', 'I say it from my heart: thank you all.', 'أقولها من قلبي: مشكورين.'), s('kalāmī min galbī, mub mujāmala.', 'My words are from my heart, not flattery.', 'كلامي من قلبي، مب مجاملة.')]),
  lw('loc_deep', 'مجاملة', 'mujāmala', 'flattery / politeness', [s('hāda mub mujāmala, hāda ṣij.', 'This is not flattery, this is the truth.', 'هذا مب مجاملة، هذا صج.'), s('mā aḥibb il-mujāmalāt il-fāḍya.', 'I do not like empty flattery.', 'ما أحب المجاملات الفاضية.')]),
  lw('loc_deep', 'قصة', 'giṣṣa', 'story', [s('kil wāḥid ʿindah giṣṣa tistāhal tinsimaʿ.', 'Everyone has a story worth hearing.', 'كل واحد عنده قصة تستاهل تنسمع.'), s('aḥibb asmaʿ giṣaṣ in-nās.', "I love hearing people's stories.", 'أحب أسمع قصص الناس.')]),
  lw('loc_deep', 'حكمة', 'ḥikma', 'wisdom', [s('fi kil majlis ḥikma.', 'In every majlis there is wisdom.', 'في كل مجلس حكمة.'), s('il-ḥikma tiyī min kbār is-sinn.', 'Wisdom comes from the elders.', 'الحكمة تيي من كبار السن.')]),
  lw('loc_deep', 'صبر', 'ṣabir', 'patience', [s('iṣ-ṣabir miftāḥ il-faraj.', 'Patience is the key to relief.', 'الصبر مفتاح الفرج.'), s('it-taʿlīm yibā ṣabir.', 'Teaching requires patience.', 'التعليم يبا صبر.')]),
  lw('loc_deep', 'نية', 'niyya', 'intention', [s('in-niyya iz-zēna tfattiḥ kil bāb.', 'A good intention opens every door.', 'النية الزينة تفتح كل باب.'), s('niyytī ṣāfya, w hāda illī yhimm.', 'My intention is pure, and that is what matters.', 'نيتي صافية، وهذا اللي يهم.')]),
  lw('loc_deep', 'أمانة', 'amāna', 'trust / integrity', [s('il-amāna rās māl it-tijāra.', 'Integrity is the capital of business.', 'الأمانة راس مال التجارة.'), s('il-amāna ʿindī khaṭṭ aḥmar.', 'Integrity for me is a red line.', 'الأمانة عندي خط أحمر.')]),
  lw('loc_deep', 'سمعة', 'sumʿa', 'reputation', [s('is-sumʿa tibnīhā sinīn w tiksirhā laḥẓa.', 'Reputation takes years to build and a moment to break.', 'السمعة تبنيها سنين وتكسرها لحظة.'), s('sumʿatī ahamm min ribḥī.', 'My reputation matters more than my profit.', 'سمعتي أهم من ربحي.')]),
  lw('loc_deep', 'وقتك ثمين', 'wagtak thamīn', 'your time is precious', [s('aʿrf inn wagtak thamīn, bikūn mukhtaṣir.', 'I know your time is precious, I will be brief.', 'أعرف إن وقتك ثمين، بكون مختصر.'), s('wagtak thamīn — mashkūr innik ʿaṭaitnī minnah.', 'Your time is precious — thank you for giving me some of it.', 'وقتك ثمين — مشكور إنك عطيتني منه.')]),
  lw('loc_deep', 'على البركة', 'ʿala il-baraka', 'with God\'s blessing (deal!)', [s('ittafagnā? ʿala il-baraka!', 'We agree? Then with God\'s blessing — deal!', 'اتفقنا؟ على البركة!'), s('ʿala il-baraka, nibdā bāchir.', 'With the blessing, we start tomorrow.', 'على البركة، نبدا باچر.')]),
  lw('loc_deep', 'كلمة رياييل', 'kilmat rayāyīl', "a man's word", [s('kilmatī kilmat rayāyīl.', 'My word is a man\'s word.', 'كلمتي كلمة رياييل.'), s('ʿindnā, il-kilma kilmat rayāyīl.', 'With us, a word is a word of honor.', 'عندنا، الكلمة كلمة رياييل.')]),
  lw('loc_deep', 'عشرة', 'ʿishra', 'long companionship', [s('il-ʿishra mā tinnasā.', 'Long companionship is never forgotten.', 'العشرة ما تنسى.'), s('baʿad khams sinīn ʿishra, ṣirnā ahal.', 'After five years together, we became family.', 'بعد خمس سنين عشرة، صرنا أهل.')]),
  lw('loc_deep', 'ود', 'widd', 'affection', [s('bainnā widd qadīm.', 'There is an old affection between us.', 'بيننا ود قديم.'), s('il-widd yibnī akthar min il-ʿuqūd.', 'Affection builds more than contracts.', 'الود يبني أكثر من العقود.')]),
  lw('loc_deep', 'تواضع', 'tawāḍuʿ', 'humility', [s('it-tawāḍuʿ zēnat il-kbār.', 'Humility is the beauty of the great.', 'التواضع زينة الكبار.'), s('anjaḥ w atwāḍaʿ — hāda mabdaʾī.', 'Succeed and stay humble — that is my principle.', 'أنجح وأتواضع — هذا مبدئي.')]),
  lw('loc_deep', 'مبدأ', 'mabdaʾ', 'principle', [s('ʿindī mabādiʾ mā atnāzal ʿanhā.', 'I have principles I will not give up.', 'عندي مبادئ ما أتنازل عنها.'), s('il-mabdaʾ gabl il-maṣlaḥa.', 'Principle before profit.', 'المبدأ قبل المصلحة.')]),
  lw('loc_deep', 'رزق', 'rizg', 'livelihood / providence', [s('ir-rizg ʿala allāh.', 'Livelihood is in God\'s hands.', 'الرزق على الله.'), s('ir-rizg magsūm.', 'Providence is already apportioned.', 'الرزق مقسوم.')]),
  lw('loc_deep', 'تجربة', 'tijruba', 'experience / trial', [s('kil tijruba tʿallim.', 'Every experience teaches.', 'كل تجربة تعلم.'), s('hal-tijruba ghayyaratnī.', 'This experience changed me.', 'هالتجربة غيرتني.')]),
  lw('loc_deep', 'بركة', 'baraka', 'blessing', [s('il-baraka fi il-bukūr.', 'The blessing is in rising early.', 'البركة في البكور.'), s('shughl fīh baraka.', 'Work that carries blessing.', 'شغل فيه بركة.')]),
  lw('loc_deep', 'الحمدلله على كل حال', 'il-ḥamdillah ʿala kil ḥāl', 'thank God in every situation', [s('rbiḥt willā khisirt: il-ḥamdillah ʿala kil ḥāl.', 'Whether I win or lose: thank God in every situation.', 'ربحت ولّا خسرت: الحمدلله على كل حال.'), s('il-ḥamdillah ʿala kil ḥāl, il-khair yāy.', 'Thank God always — the good is coming.', 'الحمدلله على كل حال، الخير ياي.')]),
];
EMIRATI_WORDS.push(...EMIRATI_LOCAL2);

// 📚 PRIORITY ORDERING — sections sorted by real-world importance for a
// learner. User feedback: "at the beginning I need the most important
// words, at the end secondary stuff." Greetings + family + numbers come
// first; weather + culture come last. Each word's priority = (section
// index × 1000) + position-within-section, so the natural section/word
// authoring order IS the priority order.
const EMIRATI_SECTION_ORDER = [
  // 🆕 2026-07-05 — the LOCAL track comes first: real street Emirati,
  // then self-expression (his story → Dralingo → networking → opinions),
  // then the engine words and Dubai daily life. The study queue starts
  // here; the original 275-word general track follows.
  'loc_street', 'loc_me', 'loc_biz', 'loc_connect',
  'loc_express', 'loc_power', 'loc_daily',
  'loc_correct', 'loc_emaar', 'loc_grateful',
  'loc_founder', 'loc_wonders', 'loc_deep',
  'greet', 'family', 'number', 'time', 'food', 'home',
  'body',  'work',   'transp', 'emot', 'verb', 'culture', 'weather',
];
(function _assignPriority() {
  const sectionIdx = {};
  EMIRATI_SECTION_ORDER.forEach((id, i) => { sectionIdx[id] = i; });
  const perSection = {};
  EMIRATI_WORDS.forEach((w) => {
    const k = w.section;
    perSection[k] = (perSection[k] || 0) + 1;
    const si = sectionIdx[k] != null ? sectionIdx[k] : 99;
    w.priority = si * 1000 + perSection[k];
  });
})();

// 🗣️ AUTO-FILL DEFAULT SENTENCES — sections 4-13 of the source file ship
// as bare triples. Rather than leave the gateway empty for 200+ words,
// every word without `ses` gets two simple template sentences so EVERY
// 🔊 in the UI has something to read. Replace these with idiomatic
// Khaleeji sentences over time (drop them in the `w(...)` call).
// 📝 Khaleeji Arabic text for the hand-authored sentences in sections 1-3.
// Source: the user's emirati_arabic_full_text.txt rendered in Arabic
// script. Lookup by transliteration so Azure ar-AE-Hamdan / Fatima can
// actually read them aloud (was falling through to MSA Google = bad
// pronunciation). Drop more here over time; any tr not in this map
// falls back to the parent word's `ar` for the audio (better than empty).
const SECTION_1_3_AR = {
  // Section 1 — Greetings & basics
  'as-salaam alaykum, shlonkum?': 'السلام عليكم، شلونكم؟',
  'as-salaam alaykum, ana Fernando.': 'السلام عليكم، أنا فيرناندو.',
  'wa alaykum as-salaam, ahlan!': 'وعليكم السلام، أهلا!',
  'A: as-salaam alaykum. B: wa alaykum as-salaam.': 'أ: السلام عليكم. ب: وعليكم السلام.',
  'shlōnak il-yōm?': 'شلونك اليوم؟',
  'hala, shlōnak?': 'هلا، شلونك؟',
  'shlōnich il-yōm?': 'شلونچ اليوم؟',
  'hala, shlōnich?': 'هلا، شلونچ؟',
  'il-ḥamdillah, ana b-khair.': 'الحمد لله، أنا بخير.',
  'shlōnak? il-ḥamdillah.': 'شلونك؟ الحمد لله.',
  "ana zain, mashkūr.": 'أنا زين، مشكور.',
  "il-yōm kān zain.": 'اليوم كان زين.',
  'marḥaba, tafaḍḍal istariḥ.': 'مرحبا، تفضل استرح.',
  'marḥaba fīk!': 'مرحبا فيك!',
  'hala hala! shlōnak?': 'هلا هلا! شلونك؟',
  "hala walla, shakhbārak?": 'هلا والله، شخبارك؟',
  'shukran jazīlan.': 'شكراً جزيلاً.',
  'shukran ya akhī.': 'شكراً يا أخي.',
  'afwan, ma alaik shay.': 'عفواً، ما عليك شي.',
  'afwan, wain il-ḥammām?': 'عفواً، وين الحمام؟',
  "maʿ as-salāma, inshallah ashoofak.": 'مع السلامة، إن شاء الله أشوفك.',
  'yalla, maʿ as-salāma!': 'يلا، مع السلامة!',
  "ashoofak bāchir inshallah.": 'أشوفك باچر إن شاء الله.',
  'inshallah kil shay zain.': 'إن شاء الله كل شي زين.',
  'māshallah, wāyid ḥilw!': 'ما شاء الله، وايد حلو!',
  'māshallah alaik!': 'ما شاء الله عليك!',
  "yalla, namshy!": 'يلا، نمشي!',
  "yalla yalla, mit'akhirīn.": 'يلا يلا، متأخرين.',
  'naʿam, ana muwāfig.': 'نعم، أنا موافق.',
  'naʿam, ṣaḥḥ.': 'نعم، صحّ.',
  'ēh, tamām.': 'إيه، تمام.',
  'ēh walla.': 'إيه والله.',
  'lā, shukran.': 'لا، شكراً.',
  "lā, ma abī.": 'لا، ما أبي.',
  'min faḍlak, aʿṭīnī māy.': 'من فضلك، أعطني ماي.',
  "min faḍlak, wain il-maṭār?": 'من فضلك، وين المطار؟',
  "āsif, ma gaṣadī.": 'آسف، ما قصدي.',
  "āsif, ana mit'akhir.": 'آسف، أنا متأخر.',
  'mā alēh, ʿādī.': 'ما عليه، عادي.',
  'A: āsif! B: mā alēh!': 'أ: آسف! ب: ما عليه!',
  "ana min Honduras.": 'أنا من هندوراس.',
  'ana adris ʿarabī.': 'أنا أدرس عربي.',
  'inta min wain?': 'إنت من وين؟',
  "inta shaghlak shū?": 'إنت شغلك شو؟',
  'hū ṣāḥbī.': 'هو صاحبي.',
  'hū min Dubay.': 'هو من دبي.',
  'hī mudarrisa.': 'هي مدرّسة.',
  'hī tilʿab wāyid.': 'هي تلعب وايد.',
  'iḥna naby nākil.': 'إحنا نبي ناكل.',
  'iḥna min il-Imārāt.': 'إحنا من الإمارات.',
  // Section 2 — Family & people
  'il-bōya rāḥ il-shughl.': 'البويا راح الشغل.',
  'abūy yiḥibb il-gahwa.': 'أبوي يحب القهوة.',
  'yumma ṭabkhat akil.': 'يما طبخت أكل.',
  'ummī aḥla waḥda.': 'أمي أحلى وحدة.',
  // 🆕 2026-06-04 — Fernando reported sentences showing the WORD's
  // Arabic instead of a real Arabic sentence. Adding the missing 76
  // entries here. Style: Khaleeji as actually spoken in the UAE.
  'il-walad yilʿab barra.': 'الولد يلعب برّا.',
  'waladī fi il-madrasa.': 'ولدي في المدرسة.',
  'il-bint shāṭra.': 'البنت شاطرة.',
  'bintī tidris ʿarabī.': 'بنتي تدرس عربي.',
  'akhūy fi Dubay.': 'أخوي في دبي.',
  'akhūy il-ichbīr.': 'أخوي الچبير.',
  'ukhtī tidris fi il-yāmiʿa.': 'أختي تدرس في الجامعة.',
  'ukhtī ṣighīra.': 'أختي صغيرة.',
  'il-ʿyāl yilʿabūn barra.': 'العيال يلعبون برّا.',
  'kam ʿyāl ʿindak?': 'كم عيال عندك؟',
  'il-yidd fi il-bait.': 'اليدّ في البيت.',
  'yiddī yiḥibb il-gahwa.': 'يدّي يحب القهوة.',
  'il-yidda ṭabkhat machbūs.': 'اليدّة طبخت مَجبوس.',
  'yiddatī ṭayyiba.': 'يدّتي طيّبة.',
  'ʿāylatī ichbīra.': 'عائلتي چبيرة.',
  'ʿāylatī fi Dubay.': 'عائلتي في دبي.',
  'ṣāḥbī min Abu Dhabi.': 'صاحبي من أبوظبي.',
  'ṣāḥbī zain.': 'صاحبي زين.',
  'ṣāḥbathā min il-madrasa.': 'صاحبتها من المدرسة.',
  'ṣāḥbatī tishtaghil fi Dubay.': 'صاحبتي تشتغل في دبي.',
  'il-rayyāl rāḥ il-sūg.': 'الرّيّال راح السوق.',
  'rayyāl ṭayyib.': 'ريّال طيّب.',
  'il-ḥurma fi il-bait.': 'الحرمة في البيت.',
  'ḥurma shāṭra.': 'حرمة شاطرة.',
  'il-nās wāyid il-yōm.': 'الناس وايد اليوم.',
  'nās ṭayyibīn.': 'ناس طيّبين.',
  'zōjhā yishtaghil fi sharīka.': 'زوجها يشتغل في شركة.',
  'zōjī fi il-bait.': 'زوجي في البيت.',
  'zōjatī ṭabkhat akil lathīth.': 'زوجتي طبخت أكل لذيذ.',
  'zōjatī fi il-shughl.': 'زوجتي في الشغل.',
  'ʿammī fi Al Ain.': 'عمّي في العين.',
  'ʿammī rayyāl ṭayyib.': 'عمّي ريّال طيّب.',
  'khālī yisāfir wāyid.': 'خالي يسافر وايد.',
  'khālī fi London.': 'خالي في لندن.',
  'il-yār ṭayyib.': 'الجار طيّب.',
  'yārnā min il-Hind.': 'جارنا من الهند.',
  // Section 3 — Numbers, money, shopping
  'wāḥid gahwa, min faḍlak.': 'واحد قهوة، من فضلك.',
  'ana abī wāḥid bass.': 'أنا أبي واحد بس.',
  'ithnain chāy, min faḍlak.': 'اثنين چاي، من فضلك.',
  'ʿindī ithnain ʿyāl.': 'عندي اثنين عيال.',
  'fi thalāth daqāyiq.': 'في ثلاث دقايق.',
  'thalāth darāhim.': 'ثلاث دراهم.',
  'il-ijtimāʿ is-sāʿa arbaʿ.': 'الاجتماع الساعة أربع.',
  'arbaʿ ashkhāṣ.': 'أربع أشخاص.',
  'khams daqāyiq bass.': 'خمس دقايق بس.',
  'ʿindī khams ikhwān.': 'عندي خمس إخوان.',
  'is-sāʿa sitta.': 'الساعة ستّة.',
  'sitta darāhim.': 'ستّة دراهم.',
  'is-sāʿa sabʿa iṣ-ṣubiḥ.': 'الساعة سبعة الصبح.',
  'sabʿa ayyām.': 'سبعة أيّام.',
  'thamān is-sāʿa.': 'ثمان الساعة.',
  'thamāniya ashkhāṣ.': 'ثمانية أشخاص.',
  'is-sāʿa tisʿa.': 'الساعة تسعة.',
  'tisʿa darāhim.': 'تسعة دراهم.',
  'ʿashra darāhim.': 'عشرة دراهم.',
  'baʿad ʿashr daqāyiq.': 'بعد عشر دقايق.',
  'ʿishrīn dirham.': 'عشرين درهم.',
  'ʿumrī ʿishrīn sana.': 'عمري عشرين سنة.',
  'mīya dirham.': 'مية درهم.',
  'il-ḥisāb mīya w khamsīn.': 'الحساب مية وخمسين.',
  'alf dirham.': 'ألف درهم.',
  'il-ījār alfēn.': 'الإيجار ألفين.',
  'ʿindak flūs?': 'عندك فلوس؟',
  'il-flūs fi il-bank.': 'الفلوس في البنك.',
  'kam dirham?': 'كم درهم؟',
  'ʿashr darāhim bass.': 'عشر دراهم بس.',
  'il-ḥisāb min faḍlak.': 'الحساب من فضلك.',
  'kam il-ḥisāb?': 'كم الحساب؟',
  'hātha ghālī wāyid.': 'هذا غالي وايد.',
  'il-ījār ghālī fi Dubay.': 'الإيجار غالي في دبي.',
  'hātha rakhīṣ.': 'هذا رخيص.',
  'abī shay rakhīṣ.': 'أبي شي رخيص.',
  'kam walad ʿindak?': 'كم ولد عندك؟',
  'abī ashtrī sayyāra.': 'أبي أشتري سيارة.',
  'wain ashtrī akil?': 'وين أشتري أكل؟',
};

(function _autoFillSentences() {
  EMIRATI_WORDS.forEach((w) => {
    if (Array.isArray(w.ses) && w.ses.length) {
      // 🔧 Two-pass enrichment:
      //   1. If the hand-authored sentence's tr is in SECTION_1_3_AR,
      //      use the real Khaleeji Arabic from the map.
      //   2. Otherwise fall back to the parent word's `ar` (so at least
      //      Hamdan/Fatima reads SOMETHING in Khaleeji, not MSA junk).
      w.ses.forEach((sent) => {
        if (sent.ar) return;
        if (SECTION_1_3_AR[sent.tr]) {
          sent.ar = SECTION_1_3_AR[sent.tr];
        } else {
          sent.ar = w.ar;          // graceful fallback
          sent.arFallback = true;  // UI can mark these as draft-Arabic
        }
      });
      return;
    }
    const en = String(w.en || '').split(' / ')[0].split('(')[0].trim() || 'this';
    // For sections 4-13 (bare entries), build template sentences with
    // REAL Arabic + transliteration + Spanish-friendly English so the 🔊
    // buttons play Khaleeji speech. Marked sesAuto so the UI flags them.
    w.ses = [
      { ar: 'هذا ' + w.ar + '.',          tr: 'hatha ' + w.tr + '.',          en: 'This is ' + en + '.' },
      { ar: 'أنا أحب ' + w.ar + '.',       tr: 'ana aḥibb ' + w.tr + '.',      en: 'I love ' + en + '.' },
    ];
    w.sesAuto = true;
  });
})();

// Deterministic daily picker, NOW ORDERED BY PRIORITY (greetings first,
// weather last). The kid sees the most useful words on day 1 and the
// long tail rolls in as they advance. We pick the next 5 UNSEEN by
// priority — no shuffling within the unseen pool.
function todaysWords(dateStr, seenIds) {
  const seen = new Set(seenIds || []);
  const unseen = EMIRATI_WORDS.filter((w) => !seen.has(w.id))
    .sort((a, b) => a.priority - b.priority);
  if (unseen.length >= 5) return unseen.slice(0, 5);
  // All caught up → re-roll a deterministic 5 anchored to date for review.
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) h = (h * 31 + dateStr.charCodeAt(i)) >>> 0;
  const pool = EMIRATI_WORDS.slice().sort((a, b) => a.priority - b.priority);
  const start = h % Math.max(1, pool.length - 5);
  return pool.slice(start, start + 5);
}

// =====================================================================
// 🆕 STUDY LIST — self-refilling 10-word / 20-sentence study queue
// =====================================================================
// User-driven redesign (2026-06-01): the kid wants a constantly-fresh
// list of ~10 unseen words with ~20 unlearned example sentences nested
// under them. When they mark a sentence OR word as learned, that item
// vanishes from the list and the next priority item slides in to
// maintain the target counts.
//
// Key principle: marking a sentence ≠ marking the parent word. The kid
// may know one of a word's sentences but still be working on others.
// So sentences and words are tracked independently; a word remains in
// the list (with whatever unlearned sentences it has left) until the
// kid explicitly marks the word itself as "vista".
//
// Inputs:
//   seenIds          — string[]   word IDs the kid has marked complete
//   learnedSentKeys  — string[]   sentence keys "wordId:index"
//   wordCap          — number     hard cap on words returned (default 10)
//   sentenceCap      — number     soft cap on visible sentences (default 20)
//
// Algorithm:
//   1. Filter words: drop any with id in seenIds
//   2. Sort by priority
//   3. Walk through, attaching only UNLEARNED sentences to each word
//   4. Stop after wordCap words OR when total visible sentences ≥ sentenceCap
//      (whichever comes first that satisfies BOTH minimums when possible)
//   5. Returns shape: [{ ...word, ses: filteredSes, sesLearnedCount: n }]
//
// "Otras" rotation: skipIds lets the client temporarily exclude a set
// of words so the next call returns later priorities. Same as before.
// =====================================================================
function studyList(opts) {
  const seenIds = opts && opts.seenIds ? opts.seenIds : [];
  const learnedSentKeys = opts && opts.learnedSentKeys ? opts.learnedSentKeys : [];
  const skipIds = opts && opts.skipIds ? opts.skipIds : [];
  // 🆕 2026-06-04 — new defaults per Fernando: 25 words / 50 sentences
  // per page. Caps were 10/20 before.
  const wordCap = (opts && opts.wordCap) || 25;
  const sentenceCap = (opts && opts.sentenceCap) || 50;
  const seenSet = new Set(seenIds);
  const skipSet = new Set(skipIds);
  const learned = new Set(learnedSentKeys);

  // 🆕 VISIBILITY RULE (Fernando 2026-06-04, refined 2026-06-04b):
  //   Rule A — "no empty cards": a word is hidden if all its sentences
  //     are already marked learned, REGARDLESS of whether the word
  //     itself is marked seen. Fernando: "everything should have
  //     sentences. One word, two sentences. After you go to like the
  //     father, those below the father, they don't contain sentences.
  //     Totally unacceptable."
  //   Rule B — "kept-for-sentences": a word that was marked seen but
  //     still has at least one unlearned sentence remains visible, so
  //     the kid can finish the remaining sentences under their parent
  //     word. The mark button switches to "Conocida · toca para
  //     deshacer" so it's not confusing.
  //   Unmarking a sentence on a fully-hidden word brings the word back
  //   automatically (Rule A flips false again).
  //   Skipped IDs ("Otras" rotation) are excluded outright — temporary
  //   "show me different ones" filter, not a study decision.
  const candidates = EMIRATI_WORDS
    .filter((w) => {
      if (skipSet.has(w.id)) return false;
      const allSes = Array.isArray(w.ses) ? w.ses : [];
      // Rule A: every sentence learned → hide (no empty cards).
      if (allSes.length && allSes.every((_, i) => learned.has(w.id + ':' + i))) {
        return false;
      }
      // Past this point we know at least one sentence is unlearned,
      // OR the word has no sentences at all (data-quality fallback).
      if (!seenSet.has(w.id)) return true;
      // word marked seen → keep only if at least one sentence still unlearned.
      // (No-sentences-AND-marked → hide, same as before.)
      if (!allSes.length) return false;
      return true;
    })
    .sort((a, b) => a.priority - b.priority);

  const out = [];
  let totalSentences = 0;
  for (const w of candidates) {
    const allSes = Array.isArray(w.ses) ? w.ses : [];
    // Keep the original index so the "wordId:index" key remains stable —
    // marking sentence 1 of a word can't shift the index of sentence 2.
    const visibleSes = allSes
      .map((s, i) => ({ s, i }))
      .filter(({ i }) => !learned.has(w.id + ':' + i))
      .map(({ s, i }) => Object.assign({}, s, { _idx: i }));
    out.push(Object.assign({}, w, {
      ses: visibleSes,
      sesLearnedCount: allSes.length - visibleSes.length,
      sesTotalCount: allSes.length,
      // 🆕 Tells the client to render the mark button in "already seen,
      // tap to undo" mode rather than the default "tap to mark seen".
      seen: seenSet.has(w.id),
    }));
    totalSentences += visibleSes.length;
    // Stop when we've hit BOTH targets — guarantees the kid sees enough
    // sentence variety without overrunning if early words are sentence-rich.
    if (out.length >= wordCap && totalSentences >= sentenceCap) break;
  }
  // If we hit the word cap before the sentence target (some words had all
  // their sentences learned), the list is what it is. Don't overrun the
  // word cap — keeping the list at "always N words max" is the contract.
  if (out.length > wordCap) out.length = wordCap;
  return out;
}

module.exports = { EMIRATI_WORDS, EMIRATI_SECTIONS, EMIRATI_SECTION_ORDER, todaysWords, studyList };
