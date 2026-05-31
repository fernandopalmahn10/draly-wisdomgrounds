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
};

let _n = 0;
function w(section, ar, tr, en, ses) {
  return { id: 'e' + (++_n), section, ar, tr, en, ses: ses || [] };
}
function s(tr, en) { return { tr, en }; }

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

// 📚 PRIORITY ORDERING — sections sorted by real-world importance for a
// learner. User feedback: "at the beginning I need the most important
// words, at the end secondary stuff." Greetings + family + numbers come
// first; weather + culture come last. Each word's priority = (section
// index × 1000) + position-within-section, so the natural section/word
// authoring order IS the priority order.
const EMIRATI_SECTION_ORDER = [
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
  // Section 2 — Family & people (a sampling; extend over time)
  'il-bōya rāḥ il-shughl.': 'البويا راح الشغل.',
  'abūy yiḥibb il-gahwa.': 'أبوي يحب القهوة.',
  'yumma ṭabkhat akil.': 'يما طبخت أكل.',
  'ummī aḥla waḥda.': 'أمي أحلى وحدة.',
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

module.exports = { EMIRATI_WORDS, EMIRATI_SECTIONS, EMIRATI_SECTION_ORDER, todaysWords };
