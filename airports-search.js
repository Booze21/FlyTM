/**
 * TMbilet Airport Search Engine v2.0
 * Professional multilingual autocomplete — comparable to Aviasales quality.
 *
 * Architecture:
 *   1. ALIAS_MAP  — multilingual names for ~350 major airports (RU, TR, AR, ZH, native)
 *   2. NAME_MAP   — official airport name strings for the same set
 *   3. SearchEngine — builds a prefix-keyed inverted index at init-time over all
 *      9 000+ AIRPORTS entries, extended with alias tokens. O(1) prefix lookup,
 *      fuzzy fallback for typos, scored ranking (popular > exact > prefix > fuzzy).
 *   4. AirportAutocomplete — drop-in UI controller. Attaches to any pair of
 *      (inputEl, listEl). Handles keyboard nav, mouse, Enter, Escape, outside-click,
 *      mobile touch, highlight, ARIA.
 *
 * Strict separation of concerns:
 *   • SearchEngine knows nothing about the DOM.
 *   • AirportAutocomplete knows nothing about the ranking algorithm.
 *   • Neither file touches the redirect or search-submit logic.
 */

(function (global) {
  'use strict';

  /* ===================================================================
     §1  MULTILINGUAL ALIAS MAP
     Keys are IATA codes. Values are arrays of additional search tokens
     (native names, Russian, Turkish, Arabic, Chinese, alternate spellings).
     This covers the airports users actually search for most — ~350 entries.
     The full 9 000-entry worldwide set is already searchable via its
     English city names and IATA code; aliases extend coverage for the
     commonly searched airports where non-English names differ significantly.
  =================================================================== */
  var ALIAS_MAP = {
    // ── Turkey ──────────────────────────────────────────────────────
    IST: ['istanbul','стамбул','İstanbul','estambul','istanboul','istanbul airport','yeni istanbul','ataturk','atatürk','ататюрк'],
    SAW: ['sabiha','sabiha gökçen','sabiha gokcen','стамбул сабиха','istanbul sabiha','gökçen'],
    AYT: ['antalya','анталья','antalya havalimanı'],
    ADB: ['izmir','İzmir','измир','smyrna'],
    ESB: ['ankara','Ankara','анкара','esenboğa','esenboga'],
    BJV: ['bodrum','бодрум','milas bodrum','bodrum milas'],
    DLM: ['dalaman','даламан'],
    GZT: ['gaziantep','газиантеп'],
    KYA: ['konya','конья'],
    TZX: ['trabzon','трабзон'],
    VAN: ['van','Ван'],
    ERZ: ['erzurum','эрзурум'],
    MLX: ['malatya','малатья'],
    KCO: ['cengiz topel','İzmit','izmit'],
    ASR: ['kayseri','кайсери'],
    DNZ: ['denizli','карделен','denizli cardak'],
    SZF: ['samsun','самсун'],
    MZH: ['amasya merzifon','амасья','merzifon'],
    IGD: ['ığdır','ıgdır'],
    BAL: ['batman','Бэтмен'],
    MSR: ['muş','муш'],
    GNY: ['şanlıurfa','sanliurfa','şanlıurfa gap'],
    DIY: ['diyarbakır','diyarbakir','диярбакыр'],
    KFS: ['kastamonu'],
    SIC: ['sinop'],
    SFQ: ['şanlıurfa'],
    TEQ: ['tekirdağ','çorlu'],
    KCM: ['kahramanmaraş','kahramanmaras'],
    // ── Russia ──────────────────────────────────────────────────────
    SVO: ['moscow','sheremetyevo','шереметьево','москва','sheremetyevo international','mow','mow moscow'],
    DME: ['moscow','domodedovo','домодедово','москва домодедово'],
    VKO: ['moscow','vnukovo','внуково','москва внуково'],
    ZIA: ['moscow','zhukovsky','жуковский','москва жуковский'],
    MOW: ['moscow','москва','moskva','moscou','mosca'],
    LED: ['saint petersburg','spb','санкт-петербург','петербург','пулково','pulkovo','leningrad','st. petersburg','st petersburg'],
    AER: ['sochi','сочи','adler'],
    KZN: ['kazan','казань'],
    SVX: ['yekaterinburg','ekaterinburg','екатеринбург'],
    ROV: ['rostov','ростов','platov'],
    KJA: ['krasnoyarsk','красноярск','yemelyanovo','емельяново'],
    OVB: ['novosibirsk','новосибирск','tolmachevo','толмачево'],
    IKT: ['irkutsk','иркутск'],
    VVO: ['vladivostok','владивосток','knevichi'],
    UFA: ['ufa','уфа'],
    KUF: ['samara','самара','курумоч'],
    NJC: ['nizhnevartovsk','нижневартовск'],
    AAQ: ['anapa','анапа'],
    GDZ: ['gelendzhik','геленджик'],
    MRV: ['mineralnye vody','минеральные воды'],
    STW: ['stavropol','ставрополь'],
    PEE: ['perm','пермь'],
    REN: ['orenburg','оренбург'],
    UUS: ['yuzhno-sakhalinsk','южно-сахалинск'],
    PKC: ['petropavlovsk','петропавловск','kamchatsky'],
    // ── Central Asia / CIS ──────────────────────────────────────────
    ASB: ['ashgabat','ashkhabad','ашхабад','Aşgabat','عشق‌آباد','тurkmenabat','ashkabat','ashkhabad international'],
    TAZ: ['dashoguz','дашогуз','дашховуз','dashhowuz'],
    MYP: ['mary','мары','türkmenabad'],
    ALA: ['almaty','алматы','алма-ата','alma-ata'],
    NQZ: ['astana','астана','нур-султан','nur-sultan','nursultan'],
    TSE: ['astana','астана','нур-султан','nursultan','nur-sultan'],
    TAS: ['tashkent','ташкент','toshkent'],
    SKD: ['samarkand','самарканд','samarqand'],
    BHK: ['bukhara','бухара','buxoro'],
    UGC: ['urgench','ургенч','urganch'],
    FEG: ['fergana','фергана','farghona'],
    NVI: ['navoi','навои'],
    BSZ: ['bishkek','бишкек','манас','manas','frunze','фрунзе'],
    OSS: ['osh','ош'],
    DYU: ['dushanbe','душанбе'],
    LBD: ['khujand','худжанд','khudzhand'],
    GYD: ['baku','баку','гейдар алиев','heydar aliyev','heydər əliyev'],
    NAJ: ['nakhchivan','нахичевань'],
    EVN: ['yerevan','ереван','zvartnots','звартноц'],
    TBS: ['tbilisi','тбилиси','tbilisi international'],
    BUS: ['batumi','батуми'],
    // ── Middle East ──────────────────────────────────────────────────
    DXB: ['dubai','дубай','дубаи','دبي','dubai international'],
    DWC: ['dubai','al maktoum','аль-мактум','jebel ali','دبي ورلد سنترال'],
    AUH: ['abu dhabi','абу-даби','أبو ظبي','zayed international'],
    DOH: ['doha','доха','الدوحة','hamad international','hamad'],
    RUH: ['riyadh','эр-рияд','الرياض','king khalid','king khaled'],
    JED: ['jeddah','джидда','jiddah','جدة','king abdulaziz'],
    MED: ['medina','медина','المدينة','prince mohammad'],
    KWI: ['kuwait','кувейт','الكويت','kuwait city'],
    BAH: ['bahrain','бахрейн','البحرين','manama'],
    MCT: ['muscat','маскат','مسقط','muscat international'],
    TLV: ['tel aviv','тель-авив','תל אביב','ben gurion','ben-gurion'],
    AMM: ['amman','амман','عمان','queen alia'],
    BEY: ['beirut','бейрут','بيروت'],
    DAM: ['damascus','дамаск','دمشق'],
    BGW: ['baghdad','багдад','بغداد'],
    IKA: ['tehran','тегеран','تهران','imam khomeini'],
    THR: ['tehran','тегеран','mehrabad','мехрабад'],
    // ── South Asia ──────────────────────────────────────────────────
    DEL: ['delhi','дели','new delhi','indira gandhi','إندلهي','नई दिल्ली'],
    BOM: ['mumbai','мумбай','bombay','бомбей','chhatrapati shivaji'],
    BLR: ['bangalore','бангалор','bengaluru'],
    MAA: ['chennai','ченнаи','madras','мадрас'],
    HYD: ['hyderabad','хайдарабад','rajiv gandhi'],
    CCU: ['kolkata','калькутта','calcutta','netaji subhash'],
    COK: ['kochi','кочин','cochin'],
    GOI: ['goa','гоа','dabolim'],
    CMB: ['colombo','коломбо','bandaranaike'],
    DAC: ['dhaka','дакка','ঢাকা','hazrat shahjalal'],
    KHI: ['karachi','карачи','كراچي','jinnah'],
    LHE: ['lahore','лахор','لاہور','allama iqbal'],
    ISB: ['islamabad','исламабад','اسلام آباد','new islamabad'],
    KTM: ['kathmandu','катманду','काठमाडौ','tribhuvan'],
    // ── East Asia ────────────────────────────────────────────────────
    PEK: ['beijing','пекин','北京','capital','bejing','pékin','pekin','capital international'],
    PKX: ['beijing','пекин','北京','daxing','大兴'],
    NAY: ['beijing','пекин','北京','nanyuan'],
    PVG: ['shanghai','шанхай','上海','pudong','浦东'],
    SHA: ['shanghai','шанхай','上海','hongqiao','虹桥'],
    CAN: ['guangzhou','гуанчжоу','广州','canton','baiyun'],
    SZX: ['shenzhen','шэньчжэнь','深圳','bao\'an'],
    CTU: ['chengdu','чэнду','成都','tianfu'],
    CKG: ['chongqing','чунцин','重庆'],
    XMN: ['xiamen','сямынь','厦门','gaoqi'],
    HGH: ['hangzhou','ханчжоу','杭州','xiaoshan'],
    NKG: ['nanjing','нанкин','南京','禄口'],
    WUH: ['wuhan','ухань','武汉'],
    TSN: ['tianjin','тяньцзинь','天津','binhai'],
    HRB: ['harbin','харбин','哈尔滨'],
    SYX: ['sanya','саньяphoenix','三亚','phoenix international'],
    HKG: ['hong kong','гонконг','香港','chek lap kok'],
    TPE: ['taipei','тайпей','台北','taoyuan'],
    NRT: ['tokyo','токио','東京','narita','成田'],
    HND: ['tokyo','токио','東京','haneda','羽田'],
    KIX: ['osaka','осака','大阪','kansai','関西'],
    NGO: ['nagoya','нагоя','名古屋','centrair','chubu'],
    FUK: ['fukuoka','фукуока','福岡'],
    CTS: ['sapporo','саппоро','札幌','chitose'],
    GMP: ['seoul','сеул','서울','gimpo','gimpo international'],
    ICN: ['seoul','сеул','서울','인천','incheon'],
    MNL: ['manila','манила','maynila','ninoy aquino'],
    CEB: ['cebu','себу','mactan-cebu'],
    KUL: ['kuala lumpur','куала-лумпур','كوالالمبور','klia','петалинг'],
    SIN: ['singapore','сингапур','سنگاپور','changi','چانگی'],
    BKK: ['bangkok','бангкок','بانکوک','suvarnabhumi','สุวรรณภูมิ'],
    DMK: ['bangkok','бангкок','don mueang','don muang','донмыанг'],
    CNX: ['chiang mai','чиангмай','เชียงใหม่'],
    HKT: ['phuket','пхукет','ภูเก็ต'],
    SGN: ['ho chi minh','хошимин','sai gon','saigon','tan son nhat','tân sơn nhất'],
    HAN: ['hanoi','ханой','noi bai','nội bài','hà nội'],
    DAD: ['da nang','дананг','đà nẵng'],
    CGK: ['jakarta','джакарта','soekarno-hatta','soekarna','soekarhatta'],
    DPS: ['bali','бали','denpasar','ngurah rai'],
    SUB: ['surabaya','сурабая'],
    // ── Europe ───────────────────────────────────────────────────────
    LHR: ['london','лондон','لندن','heathrow','хитроу'],
    LGW: ['london','лондон','gatwick','гатвик'],
    STN: ['london','лондон','stansted','стэнстед'],
    LTN: ['london','лондон','luton','лютон'],
    LCY: ['london','лондон','city airport'],
    CDG: ['paris','париж','باريس','charles de gaulle','roissy','шарль де голль'],
    ORY: ['paris','париж','orly','орли'],
    FRA: ['frankfurt','франкфурт','франкфурт-на-майне'],
    MUC: ['munich','мюнхен','münchen'],
    BER: ['berlin','берлин','brandenburg','شتوتغارت'],
    HAM: ['hamburg','гамбург'],
    DUS: ['dusseldorf','düsseldorf','дюссельдорф'],
    CGN: ['cologne','köln','кёльн','koeln'],
    STR: ['stuttgart','штутгарт'],
    HAJ: ['hannover','ганновер'],
    NUE: ['nuremberg','nürnberg','нюрнберг'],
    MAD: ['madrid','мадрид','ماردريد','barajas'],
    BCN: ['barcelona','барселона','بارسلون','el prat'],
    PMI: ['palma','пальма','mallorca','мальорка','majorka'],
    AGP: ['malaga','малага'],
    VLC: ['valencia','валенсия'],
    SVQ: ['seville','sevilla','sevilla','севилья'],
    FCO: ['rome','рим','فيينا','fiumicino','фьюмичино','leonardo da vinci'],
    CIA: ['rome','рим','ciampino','чампино'],
    MXP: ['milan','милан','malpensa','мальпенса'],
    BGY: ['milan','милан','bergamo','бергамо','orio al serio'],
    LIN: ['milan','милан','linate','линате'],
    VCE: ['venice','венеция','venezia'],
    NAP: ['naples','неаполь','napoli'],
    BLQ: ['bologna','болонья'],
    FLR: ['florence','флоренция','firenze'],
    CAG: ['cagliari','кальяри'],
    AMS: ['amsterdam','амстердам','schiphol','схипхол'],
    BRU: ['brussels','брюссель','بروكسل','zaventem'],
    ZRH: ['zurich','цюрих','zürich','زيورخ'],
    GVA: ['geneva','женева','genève','genf'],
    VIE: ['vienna','вена','فيينا','wien','schwechat'],
    PRG: ['prague','прага','václav havel','vaclav havel'],
    WAW: ['warsaw','варшава','chopin','шопен'],
    KRK: ['krakow','краков','kraków','balice','john paul ii'],
    WRO: ['wroclaw','вроцлав','wrocław','strachowice'],
    GDN: ['gdansk','гданьск','gdańsk','lech walesa','tricity'],
    POZ: ['poznan','познань','poznań','lawica'],
    BUD: ['budapest','будапешт','ferihegy','liszt'],
    OTP: ['bucharest','бухарест','henri coanda','otopeni'],
    SOF: ['sofia','софия','sofiya'],
    ATH: ['athens','афины','Αθήνα','eleftherios venizelos'],
    SKG: ['thessaloniki','салоники','makedonia'],
    HER: ['heraklion','ираклион','crete','крит'],
    CFU: ['corfu','корфу','ioannis kapodistrias'],
    LIS: ['lisbon','лиссабон','لشبونة','humberto delgado'],
    OPO: ['porto','порто'],
    FAO: ['faro','фаро','algarve'],
    CPH: ['copenhagen','копенгаген','kastrup'],
    ARN: ['stockholm','стокгольм','arlanda'],
    OSL: ['oslo','осло','gardermoen'],
    BGO: ['bergen','берген'],
    TRD: ['trondheim','тронхейм'],
    HEL: ['helsinki','хельсинки','vantaa'],
    RVN: ['rovaniemi','рованиеми'],
    DUB: ['dublin','дублин','dublin airport'],
    SNN: ['shannon','шэннон'],
    EDI: ['edinburgh','эдинбург'],
    MAN: ['manchester','манчестер'],
    BHX: ['birmingham','бирмингем'],
    GLA: ['glasgow','глазго'],
    NCL: ['newcastle','ньюкасл'],
    BRS: ['bristol','бристоль'],
    LBA: ['leeds','лидс','bradford'],
    BOH: ['bournemouth','борнмут'],
    LPL: ['liverpool','ливерпуль'],
    RMO: ['chisinau','кишинев','кишинёв','moldova','chișinău'],
    ODS: ['odessa','одесса','odesa'],
    KBP: ['kyiv','киев','boryspil','бориспіль','borispol','kiev boryspil','kyiv boryspil'],
    LWO: ['lviv','львов','lvov','львів'],
    HRK: ['kharkiv','харьков','харків'],
    DNK: ['dnipro','дніпро','дніпропетровськ','dnepropetrovsk'],
    OZH: ['zaporizhzhia','zaporizhzhia','запорожье','запоріжжя'],
    MSQ: ['minsk','минск','national'],
    TGD: ['podgorica','подгорица','titograd'],
    BEG: ['belgrade','белград','nikola tesla'],
    SPU: ['split','сплит'],
    DBV: ['dubrovnik','дубровник'],
    ZAG: ['zagreb','загреб'],
    LJU: ['ljubljana','люблянa'],
    SKP: ['skopje','скопье'],
    TIA: ['tirana','тирана'],
    PRN: ['pristina','приштина'],
    SJJ: ['sarajevo','сараево'],
    // ── Africa ───────────────────────────────────────────────────────
    CAI: ['cairo','каир','القاهرة','el cairo'],
    HRG: ['hurghada','хургада','الغردقة'],
    SSH: ['sharm el sheikh','шарм-эль-шейх','شرم الشيخ','sharm'],
    LXR: ['luxor','луксор','الاقصر'],
    ASW: ['aswan','асуан'],
    ALG: ['algiers','алжир','الجزائر','houari boumediene'],
    TUN: ['tunis','тунис','تونس','carthage'],
    CMN: ['casablanca','касабланка','الدار البيضاء','mohammed v'],
    RAK: ['marrakech','марракеш','مراكش','menara'],
    RBA: ['rabat','рабат','الرباط'],
    TNG: ['tangier','танжер','ibn batuta'],
    TRI: ['tripoli','триполи','طرابلس','mitiga'],
    NBO: ['nairobi','найроби','jomo kenyatta'],
    MBA: ['mombasa','момбаса'],
    EBB: ['entebbe','энтеббе','kampala'],
    DAR: ['dar es salaam','дар-эс-салам'],
    JNB: ['johannesburg','йоханнесбург','OR tambo','or tambo'],
    CPT: ['cape town','кейптаун','CT'],
    DUR: ['durban','дурбан'],
    LOS: ['lagos','лагос','murtala muhammed'],
    ABV: ['abuja','абуджа'],
    ACC: ['accra','аккра','kotoka'],
    ABJ: ['abidjan','абиджан'],
    DKR: ['dakar','дакар','blaise diagne'],
    ADD: ['addis ababa','аддис-абеба','addis abeba','bole'],
    KRT: ['khartoum','хартум','الخرطوم'],
    // ── Americas ─────────────────────────────────────────────────────
    JFK: ['new york','нью-йорк','يورك','kennedy','jfk'],
    LGA: ['new york','нью-йорк','laguardia','la guardia'],
    EWR: ['new york','нью-йорк','newark'],
    LAX: ['los angeles','лос-анджелес','lax'],
    ORD: ["chicago","чикаго","o'hare","ohare"],
    MDW: ['chicago','чикаго','midway'],
    DFW: ['dallas','даллас','fort worth','дfw'],
    SFO: ['san francisco','сан-франциско','sfo'],
    OAK: ['oakland','окленд'],
    SJC: ['san jose','сан-хосе'],
    MIA: ['miami','майами','miami international'],
    FLL: ['fort lauderdale','форт-лодердейл','miami ft lauderdale'],
    ATL: ['atlanta','атланта','hartsfield'],
    BOS: ['boston','бостон','logan'],
    SEA: ['seattle','сиэтл','tacoma','sea-tac'],
    DEN: ['denver','денвер'],
    LAS: ['las vegas','лас-вегас','mccarran','harry reid'],
    PHX: ['phoenix','феникс','sky harbor'],
    IAD: ['washington','вашингтон','dulles'],
    DCA: ['washington','вашингтон','reagan'],
    BWI: ['baltimore','балтимор','thurgood marshall'],
    MSP: ['minneapolis','миннеаполис','saint paul'],
    DTW: ['detroit','детройт','metro'],
    CLT: ['charlotte','шарлотт','douglas'],
    IAH: ['houston','хьюстон','intercontinental'],
    HOU: ['houston','хьюстон','hobby'],
    SAN: ['san diego','сан-диего'],
    TPA: ['tampa','тампа'],
    MCO: ['orlando','орландо'],
    YYZ: ['toronto','торонто','pearson'],
    YYC: ['calgary','калгари'],
    YVR: ['vancouver','ванкувер'],
    YUL: ['montreal','монреаль','montréal','trudeau'],
    YOW: ['ottawa','оттава'],
    YEG: ['edmonton','эдмонтон'],
    GRU: ['sao paulo','são paulo','сан-паулу','guarulhos'],
    CGH: ['sao paulo','são paulo','congonhas'],
    GIG: ['rio de janeiro','рио-де-жанейро','rio','galeao','galeão'],
    SDU: ['rio de janeiro','рио','santos dumont'],
    BSB: ['brasilia','бразилиа','brasília'],
    FOR: ['fortaleza','форталеза'],
    SSA: ['salvador','салвадор'],
    MDE: ['medellin','медельин','medellín','josé maría córdova'],
    BOG: ['bogota','богота','bogotá','el dorado'],
    LIM: ['lima','лима','jorge chavez'],
    UIO: ['quito','кито'],
    GYE: ['guayaquil','гуаякиль'],
    SCL: ['santiago','сантьяго','arturo merino benitez'],
    EZE: ['buenos aires','буэнос-айрес','ministro pistarini','ezeiza'],
    AEP: ['buenos aires','буэнос-айрес','aeroparque','jorge newbery'],
    MVD: ['montevideo','монтевидео'],
    ASU: ['asuncion','асунсьон','asunción'],
    MEX: ['mexico city','мехико','ciudad de mexico','benito juarez'],
    GDL: ['guadalajara','гвадалахара'],
    MTY: ['monterrey','монтеррей'],
    CUN: ['cancun','канкун'],
    HAV: ['havana','гавана','la habana','jose marti'],
    SDQ: ['santo domingo','санто-доминго'],
    SJU: ['san juan','сан-хуан'],
    PTY: ['panama','панама','tocumen'],
    GUA: ['guatemala city','гватемала'],
    SAL: ['san salvador','сан-сальвадор','el salvador'],
    // ── Oceania ──────────────────────────────────────────────────────
    SYD: ['sydney','сидней','kingsford smith'],
    MEL: ['melbourne','мельбурн','tullamarine'],
    BNE: ['brisbane','брисбен'],
    PER: ['perth','перт'],
    ADL: ['adelaide','аделаида'],
    AKL: ['auckland','окленд','新西蘭'],
    WLG: ['wellington','веллингтон'],
    CHC: ['christchurch','крайстчерч'],
    NAN: ['nadi','нади','fiji','фиджи'],
  };

  /* ===================================================================
     §2  AIRPORT NAME MAP
     Official or commonly known airport names for the same ~350 entries.
     Used in the third line of the dropdown result.
  =================================================================== */
  var NAME_MAP = {
    IST: 'Istanbul Airport', SAW: 'Sabiha Gökçen International Airport',
    AYT: 'Antalya Airport', ADB: 'İzmir Adnan Menderes Airport',
    ESB: 'Ankara Esenboğa Airport', BJV: 'Milas-Bodrum Airport',
    DLM: 'Dalaman Airport', GZT: 'Gaziantep Oğuzeli Airport',
    SVO: 'Sheremetyevo International Airport', DME: 'Domodedovo International Airport',
    VKO: 'Vnukovo International Airport', ZIA: 'Zhukovsky International Airport',
    LED: 'Pulkovo Airport', AER: 'Sochi International Airport',
    KZN: 'Kazan International Airport', SVX: 'Koltsovo International Airport',
    ROV: 'Platov International Airport', KJA: 'Krasnoyarsk Yemelyanovo Airport',
    OVB: 'Novosibirsk Tolmachevo Airport', IKT: 'Irkutsk Airport',
    VVO: 'Vladivostok International Airport', UFA: 'Ufa International Airport',
    ASB: 'Ashgabat International Airport',
    TAZ: 'Daşoguz Airport', MYP: 'Mary Airport',
    ALA: 'Almaty International Airport', NQZ: 'Nursultan Nazarbayev International Airport',
    TSE: 'Nursultan Nazarbayev International Airport',
    TAS: 'Tashkent International Airport', SKD: 'Samarkand International Airport',
    BHK: 'Bukhara International Airport', BSZ: 'Manas International Airport',
    DYU: 'Dushanbe Airport', GYD: 'Heydar Aliyev International Airport',
    EVN: 'Zvartnots International Airport', TBS: 'Tbilisi International Airport',
    DXB: 'Dubai International Airport', DWC: 'Al Maktoum International Airport',
    AUH: 'Abu Dhabi International Airport', DOH: 'Hamad International Airport',
    RUH: 'King Khalid International Airport', JED: 'King Abdulaziz International Airport',
    KWI: 'Kuwait International Airport', BAH: 'Bahrain International Airport',
    MCT: 'Muscat International Airport', TLV: 'Ben Gurion International Airport',
    AMM: 'Queen Alia International Airport',
    IKA: 'Imam Khomeini International Airport',
    DEL: 'Indira Gandhi International Airport', BOM: 'Chhatrapati Shivaji Maharaj International Airport',
    BLR: 'Kempegowda International Airport', MAA: 'Chennai International Airport',
    HYD: 'Rajiv Gandhi International Airport', CCU: 'Netaji Subhash Chandra Bose International Airport',
    CMB: 'Bandaranaike International Airport', DAC: 'Hazrat Shahjalal International Airport',
    KHI: 'Jinnah International Airport', LHE: 'Allama Iqbal International Airport',
    ISB: 'New Islamabad International Airport',
    PEK: 'Beijing Capital International Airport', PKX: 'Beijing Daxing International Airport',
    PVG: 'Shanghai Pudong International Airport', SHA: 'Shanghai Hongqiao International Airport',
    CAN: 'Guangzhou Baiyun International Airport', SZX: 'Shenzhen Bao\'an International Airport',
    HKG: 'Hong Kong International Airport', TPE: 'Taiwan Taoyuan International Airport',
    NRT: 'Narita International Airport', HND: 'Haneda Airport',
    KIX: 'Kansai International Airport', ICN: 'Incheon International Airport',
    GMP: 'Gimpo International Airport', MNL: 'Ninoy Aquino International Airport',
    KUL: 'Kuala Lumpur International Airport', SIN: 'Singapore Changi Airport',
    BKK: 'Suvarnabhumi Airport', DMK: 'Don Mueang International Airport',
    CGK: 'Soekarno-Hatta International Airport', DPS: 'Ngurah Rai International Airport',
    SGN: 'Tan Son Nhat International Airport', HAN: 'Noi Bai International Airport',
    LHR: 'Heathrow Airport', LGW: 'Gatwick Airport', STN: 'Stansted Airport',
    CDG: 'Charles de Gaulle Airport', ORY: 'Orly Airport',
    FRA: 'Frankfurt Airport', MUC: 'Munich Airport', BER: 'Berlin Brandenburg Airport',
    MAD: 'Adolfo Suárez Madrid-Barajas Airport', BCN: 'Barcelona-El Prat Airport',
    FCO: 'Leonardo da Vinci International Airport', MXP: 'Milan Malpensa Airport',
    AMS: 'Amsterdam Airport Schiphol', BRU: 'Brussels Airport',
    ZRH: 'Zürich Airport', GVA: 'Geneva Airport',
    VIE: 'Vienna International Airport', PRG: 'Václav Havel Airport Prague',
    WAW: 'Warsaw Chopin Airport', BUD: 'Budapest Ferenc Liszt International Airport',
    ATH: 'Athens International Airport Eleftherios Venizelos',
    LIS: 'Humberto Delgado Airport', CPH: 'Copenhagen Airport',
    ARN: 'Stockholm Arlanda Airport', OSL: 'Oslo Gardermoen Airport',
    HEL: 'Helsinki Vantaa Airport', DUB: 'Dublin Airport',
    KBP: 'Kyiv Boryspil International Airport', GYD: 'Heydar Aliyev International Airport',
    CAI: 'Cairo International Airport', HRG: 'Hurghada International Airport',
    SSH: 'Sharm el-Sheikh International Airport', CMN: 'Mohammed V International Airport',
    NBO: 'Jomo Kenyatta International Airport', JNB: 'O.R. Tambo International Airport',
    LOS: 'Murtala Muhammed International Airport', ADD: 'Addis Ababa Bole International Airport',
    JFK: 'John F. Kennedy International Airport', LAX: 'Los Angeles International Airport',
    ORD: "O'Hare International Airport", SFO: 'San Francisco International Airport',
    MIA: 'Miami International Airport', ATL: 'Hartsfield-Jackson Atlanta International Airport',
    DFW: 'Dallas/Fort Worth International Airport', DEN: 'Denver International Airport',
    BOS: 'Logan International Airport', SEA: 'Seattle-Tacoma International Airport',
    LAS: 'Harry Reid International Airport', PHX: 'Phoenix Sky Harbor International Airport',
    IAD: 'Washington Dulles International Airport', YYZ: 'Toronto Pearson International Airport',
    YVR: 'Vancouver International Airport', YUL: 'Montréal-Trudeau International Airport',
    GRU: 'São Paulo Guarulhos International Airport', GIG: 'Rio de Janeiro Galeão International Airport',
    BOG: 'El Dorado International Airport', LIM: 'Jorge Chávez International Airport',
    SCL: 'Arturo Merino Benítez International Airport', EZE: 'Ministro Pistarini International Airport',
    MEX: 'Benito Juárez International Airport', CUN: 'Cancún International Airport',
    PTY: 'Tocumen International Airport', HAV: 'José Martí International Airport',
    SYD: 'Kingsford Smith Airport', MEL: 'Melbourne Airport',
    AKL: 'Auckland Airport',
    OTP: 'Henri Coandă International Airport', SOF: 'Sofia Airport',
    BEG: 'Nikola Tesla Airport', TIA: 'Tirana International Airport',
    MSQ: 'Minsk National Airport',
  };

  /* ===================================================================
     §3  SEARCH ENGINE
     Builds a token-keyed index once. Each token is a 1- to 4-char prefix
     of every searchable string. Lookup is O(matching tokens).
  =================================================================== */
  var SearchEngine = (function () {
    // Index: token (lowercase) → Set of airport array indices
    var _index = null;
    var _airports = null;

    /**
     * Normalise a string for indexing/matching:
     * lower-case, remove diacritics, collapse spaces.
     */
    function norm(s) {
      return s
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // strip combining diacritics
        .replace(/[İI]/g, 'i')                               // Turkish İ → i
        .replace(/[Şş]/g, 's')                               // Turkish Ş
        .replace(/[Ğğ]/g, 'g')
        .replace(/[Üü]/g, 'u')
        .replace(/[Öö]/g, 'o')
        .replace(/[Çç]/g, 'c')
        .replace(/\s+/g, ' ')
        .trim();
    }

    /** Split into tokens and return all their prefix slices (1..4 chars) */
    function prefixes(str) {
      var result = [];
      var parts = norm(str).split(/[\s\-\/,\.]+/).filter(Boolean);
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        for (var len = 1; len <= Math.min(p.length, 4); len++) {
          result.push(p.slice(0, len));
        }
        // Also add the whole word if it's longer than 4 chars
        if (p.length > 4) result.push(p);
      }
      return result;
    }

    function addToIndex(token, idx) {
      if (!_index[token]) _index[token] = [];
      if (_index[token].indexOf(idx) === -1) _index[token].push(idx);
    }

    function build(airports) {
      _airports = airports;
      _index = Object.create(null);

      for (var i = 0; i < airports.length; i++) {
        var a = airports[i];
        // City name
        var cityPfx = prefixes(a.city);
        for (var j = 0; j < cityPfx.length; j++) addToIndex(cityPfx[j], i);

        // Country
        var ctryPfx = prefixes(a.country);
        for (var j = 0; j < ctryPfx.length; j++) addToIndex(ctryPfx[j], i);

        // IATA code (full only — "IST" prefix → "i","is","ist","ist")
        var code = a.code.toLowerCase();
        for (var len = 1; len <= code.length; len++) addToIndex(code.slice(0, len), i);

        // Airport name (if known)
        var aname = NAME_MAP[a.code];
        if (aname) {
          var namePfx = prefixes(aname);
          for (var j = 0; j < namePfx.length; j++) addToIndex(namePfx[j], i);
        }

        // Multilingual aliases
        var aliases = ALIAS_MAP[a.code];
        if (aliases) {
          for (var k = 0; k < aliases.length; k++) {
            var aliasPfx = prefixes(aliases[k]);
            for (var j = 0; j < aliasPfx.length; j++) addToIndex(aliasPfx[j], i);
          }
        }
      }
    }

    /**
     * Score an airport against a normalised query.
     * Higher = better match. Returns 0 if not a match.
     */
    function score(a, query) {
      var nCity    = norm(a.city);
      var nCountry = norm(a.country);
      var nCode    = a.code.toLowerCase();
      var nAlias   = (ALIAS_MAP[a.code] || []).map(norm);
      var nName    = norm(NAME_MAP[a.code] || '');

      var score = 0;
      var qlen  = query.length;

      // Exact IATA code match
      if (nCode === query) score += 120;
      else if (nCode.startsWith(query)) score += 60;

      // Exact city match
      if (nCity === query) score += 100;
      else if (nCity.startsWith(query)) score += 50;
      else if (nCity.includes(query)) score += 20;

      // Country match
      if (nCountry.startsWith(query)) score += 10;

      // Alias match
      for (var i = 0; i < nAlias.length; i++) {
        if (nAlias[i] === query) { score += 90; break; }
        if (nAlias[i].startsWith(query)) { score += 45; break; }
        if (nAlias[i].includes(query))   { score += 15; break; }
      }

      // Airport name match
      if (nName) {
        if (nName.startsWith(query)) score += 30;
        else if (nName.includes(query)) score += 12;
      }

      // Popularity bonus
      if (a.popular) score += 25;

      return score;
    }

    /**
     * Simple fuzzy: check if query chars appear in sequence in target.
     * Used only as fallback when prefix index has no hits.
     */
    function fuzzyMatch(target, query) {
      var ti = 0, qi = 0;
      target = norm(target); query = norm(query);
      while (ti < target.length && qi < query.length) {
        if (target[ti] === query[qi]) qi++;
        ti++;
      }
      return qi === query.length;
    }

    function search(raw, limit) {
      if (!_airports || !_index) return [];
      limit = limit || 8;
      raw = raw.trim();
      if (!raw) return [];

      var query = norm(raw);
      if (!query) return [];

      // Split multi-word queries for intersection logic
      var parts = query.split(' ').filter(Boolean);

      // Collect candidates from index using first token
      var firstPart = parts[0];
      var candidates = _index[firstPart] ? _index[firstPart].slice() : [];

      // For each additional part, intersect
      for (var pi = 1; pi < parts.length; pi++) {
        var pCands = _index[parts[pi]] || [];
        var newCands = [];
        for (var ci = 0; ci < candidates.length; ci++) {
          if (pCands.indexOf(candidates[ci]) !== -1) newCands.push(candidates[ci]);
        }
        candidates = newCands;
      }

      // Fuzzy fallback if no index hit and query ≥ 3 chars
      if (candidates.length === 0 && query.length >= 3) {
        for (var i = 0; i < _airports.length; i++) {
          var a = _airports[i];
          if (
            fuzzyMatch(a.city, query) ||
            fuzzyMatch(a.code, query) ||
            (ALIAS_MAP[a.code] && ALIAS_MAP[a.code].some(function(al){ return fuzzyMatch(al, query); }))
          ) {
            candidates.push(i);
          }
        }
      }

      // Score & sort candidates
      var scored = [];
      for (var ci = 0; ci < candidates.length; ci++) {
        var a = _airports[candidates[ci]];
        var s = score(a, query);
        if (s > 0) scored.push({ a: a, s: s });
      }

      scored.sort(function (x, y) { return y.s - x.s; });

      // Deduplicate by IATA code (city popular entry wins over worldide duplicate)
      var seen = Object.create(null);
      var results = [];
      for (var i = 0; i < scored.length && results.length < limit; i++) {
        var code = scored[i].a.code;
        if (!seen[code]) {
          seen[code] = true;
          results.push(scored[i].a);
        }
      }
      return results;
    }

    return { build: build, search: search, norm: norm };
  })();

  /* ===================================================================
     §4  TEXT HIGHLIGHT HELPER
     Wraps the matching portion of text in a <mark> tag.
  =================================================================== */
  function highlightText(text, query) {
    if (!query) return escHtml(text);
    var nText  = SearchEngine.norm(text);
    var nQuery = SearchEngine.norm(query);
    var idx    = nText.indexOf(nQuery);
    if (idx === -1) return escHtml(text);
    return (
      escHtml(text.slice(0, idx)) +
      '<mark>' + escHtml(text.slice(idx, idx + nQuery.length)) + '</mark>' +
      escHtml(text.slice(idx + nQuery.length))
    );
  }

  function escHtml(s) {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ===================================================================
     §5  AUTOCOMPLETE UI CONTROLLER
     Attach to any (input, list) pair. Manages:
     • Debounced search on input
     • Keyboard navigation (↑ ↓ Enter Escape Tab)
     • Mouse/touch selection
     • Click-outside close
     • ARIA: role=listbox / role=option / aria-activedescendant
     • Stores IATA code on the input element as inputEl.dataset.code
  =================================================================== */
  function AirportAutocomplete(inputEl, listEl, opts) {
    opts = opts || {};
    var DEBOUNCE_MS = opts.debounce || 120;
    var MAX_RESULTS = opts.maxResults || 8;

    var activeIdx = -1;
    var items     = [];
    var timer     = null;
    var isOpen    = false;

    // ARIA setup
    var listId = listEl.id || ('ac-list-' + Math.random().toString(36).slice(2));
    listEl.id  = listId;
    listEl.setAttribute('role', 'listbox');
    inputEl.setAttribute('role', 'combobox');
    inputEl.setAttribute('aria-autocomplete', 'list');
    inputEl.setAttribute('aria-haspopup', 'listbox');
    inputEl.setAttribute('aria-controls', listId);
    inputEl.setAttribute('aria-expanded', 'false');

    function open()  { isOpen = true;  listEl.classList.add('open');    inputEl.setAttribute('aria-expanded', 'true');  }
    function close() { isOpen = false; listEl.classList.remove('open'); inputEl.setAttribute('aria-expanded', 'false'); activeIdx = -1; highlight(-1); }

    function highlight(idx) {
      activeIdx = idx;
      var all = listEl.querySelectorAll('.autocomplete-item');
      for (var i = 0; i < all.length; i++) {
        all[i].classList.toggle('hi', i === idx);
        all[i].setAttribute('aria-selected', i === idx ? 'true' : 'false');
      }
      if (idx >= 0 && all[idx]) {
        inputEl.setAttribute('aria-activedescendant', all[idx].id);
        // Scroll into view
        var el = all[idx];
        var parent = listEl;
        if (el.offsetTop < parent.scrollTop) {
          parent.scrollTop = el.offsetTop;
        } else if (el.offsetTop + el.offsetHeight > parent.scrollTop + parent.clientHeight) {
          parent.scrollTop = el.offsetTop + el.offsetHeight - parent.clientHeight;
        }
      } else {
        inputEl.removeAttribute('aria-activedescendant');
      }
    }

    function selectItem(airport) {
      inputEl.value = airport.city + ' (' + airport.code + ')';
      inputEl.dataset.code = airport.code;
      close();
      inputEl.dispatchEvent(new CustomEvent('airport:selected', {
        detail: airport, bubbles: true
      }));
    }

    function renderItem(airport, idx) {
      var li = document.createElement('div');
      li.className = 'autocomplete-item';
      li.setAttribute('role', 'option');
      li.id = listId + '-item-' + idx;
      li.setAttribute('aria-selected', 'false');

      var query = inputEl.value.trim();

      // Airport name (third line)
      var aname = NAME_MAP[airport.code] || (airport.city + ' Airport');

      li.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
          '<path d="M21 16l-7-7-7 7"/>' +
          '<path d="M3 8h18M3 12h18"/>' +
          '<circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none"/>' +
          '<path d="M5 19l7-7 7 7"/>' +
        '</svg>' +
        '<div class="ac-main">' +
          '<div class="ac-row1">' +
            '<span class="ac-city">' + highlightText(airport.city, query) + '</span>' +
            '<span class="ac-flag">' + (airport.flag || '') + '</span>' +
            '<span class="code">' + airport.code + '</span>' +
          '</div>' +
          '<div class="ac-row2">' + escHtml(aname) + '</div>' +
          '<div class="ac-row3">' + escHtml(airport.country) + '</div>' +
        '</div>';

      li.addEventListener('mousedown', function (e) {
        e.preventDefault(); // keep focus on input
        selectItem(airport);
      });

      li.addEventListener('mousemove', function () {
        highlight(idx);
      });

      return li;
    }

    function render(results) {
      items = results;
      listEl.innerHTML = '';
      if (results.length === 0) { close(); return; }

      var frag = document.createDocumentFragment();
      for (var i = 0; i < results.length; i++) {
        frag.appendChild(renderItem(results[i], i));
      }
      listEl.appendChild(frag);
      open();
      highlight(-1);
    }

    function doSearch() {
      var q = inputEl.value.trim();
      if (!q) { close(); return; }
      var results = SearchEngine.search(q, MAX_RESULTS);
      render(results);
    }

    // Input handler with debounce
    inputEl.addEventListener('input', function () {
      // Clear stored code whenever user types
      delete inputEl.dataset.code;
      clearTimeout(timer);
      timer = setTimeout(doSearch, DEBOUNCE_MS);
    });

    // Keyboard navigation
    inputEl.addEventListener('keydown', function (e) {
      var all = listEl.querySelectorAll('.autocomplete-item');
      var count = all.length;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (!isOpen && inputEl.value.trim()) { doSearch(); return; }
        highlight((activeIdx + 1) % count);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        highlight((activeIdx - 1 + count) % count);
      } else if (e.key === 'Enter') {
        if (isOpen && activeIdx >= 0 && items[activeIdx]) {
          e.preventDefault();
          selectItem(items[activeIdx]);
        }
      } else if (e.key === 'Escape' || e.key === 'Tab') {
        close();
      }
    });

    // Focus: show suggestions if input has value
    inputEl.addEventListener('focus', function () {
      if (inputEl.value.trim() && !isOpen) doSearch();
    });

    // Click-outside
    document.addEventListener('click', function (e) {
      if (!listEl.contains(e.target) && e.target !== inputEl) close();
    });

    // Touch: close on scroll (mobile UX)
    document.addEventListener('touchmove', function () { close(); }, { passive: true });

    return { close: close, search: doSearch };
  }

  /* ===================================================================
     §6  ADDITIONAL STYLES
     Injected once. Extends existing .autocomplete-item styles for the
     3-row layout without touching any other CSS.
  =================================================================== */
  function injectStyles() {
    if (document.getElementById('tmb-ac-styles')) return;
    var style = document.createElement('style');
    style.id = 'tmb-ac-styles';
    style.textContent = [
      /* Widen the dropdown a little for 3-row layout */
      '.autocomplete-list { max-width: min(420px, 92vw); }',

      /* SVG plane icon — override parent stroke to a lighter tone */
      '.autocomplete-item > svg { stroke: #9CA3AF; flex-shrink: 0; }',

      /* Main content block */
      '.ac-main { display: flex; flex-direction: column; gap: 1px; min-width: 0; flex: 1; }',

      /* Row 1: city name + flag + code badge */
      '.ac-row1 { display: flex; align-items: center; gap: 6px; }',
      '.ac-city { font-weight: 700; font-size: 14px; color: var(--text); }',
      '.ac-flag { font-size: 14px; line-height: 1; flex-shrink: 0; }',

      /* Remove the old .city rule's auto-margin trick — code badge handles spacing */
      '.autocomplete-item .code { margin-left: auto; }',

      /* Row 2: airport name (dim, medium) */
      '.ac-row2 { font-size: 12px; font-weight: 500; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',

      /* Row 3: country (dimmer, small) */
      '.ac-row3 { font-size: 11px; font-weight: 500; color: #9CA3AF; }',

      /* <mark> highlight */
      '.autocomplete-item mark { background: rgba(50, 205, 50, 0.15); color: var(--accent-darker); border-radius: 3px; padding: 0 1px; font-style: normal; font-weight: 800; }',

      /* Active/hover state */
      '.autocomplete-item.hi, .autocomplete-item:hover { background: var(--accent-tint); }',
      '.autocomplete-item.hi .ac-city, .autocomplete-item:hover .ac-city { color: var(--accent-darker); }',
      '.autocomplete-item.hi > svg, .autocomplete-item:hover > svg { stroke: var(--accent-darker); }',

      /* Smooth scroll within dropdown */
      '.autocomplete-list { scroll-behavior: smooth; }',

      /* Padding tweak so 3-row items have breathing room */
      '.autocomplete-item { padding: 9px 14px; align-items: flex-start; gap: 10px; cursor: pointer; }',
    ].join('\n');
    document.head.appendChild(style);
  }

  /* ===================================================================
     §7  INITIALISATION
     Called once AIRPORTS is defined (airports.js already loaded).
     Replaces the old "open on focus with no query" behaviour — now the
     dropdown only opens when the user has actually typed something.
  =================================================================== */
  function init() {
    if (typeof AIRPORTS === 'undefined' || !AIRPORTS.length) {
      console.warn('[TMbilet Search] AIRPORTS not found. Did airports.js load first?');
      return;
    }

    // Build index
    SearchEngine.build(AIRPORTS);
    injectStyles();

    // Attach to FROM field
    var fromInput = document.getElementById('fromInput');
    var fromList  = document.getElementById('fromList');
    if (fromInput && fromList) AirportAutocomplete(fromInput, fromList);

    // Attach to TO field
    var toInput = document.getElementById('toInput');
    var toList  = document.getElementById('toList');
    if (toInput && toList) AirportAutocomplete(toInput, toList);
  }

  // Expose so app.js can call window.AirportSearch.init() if needed
  global.AirportSearch = { init: init, engine: SearchEngine };

  // Auto-init when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    // Defer one tick so airports.js is guaranteed to have been eval'd
    setTimeout(init, 0);
  }

}(window));
