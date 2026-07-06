// Station catalog from radio-guaka (radio.guaka.org / pleXtr).
const channels = {
  // SomaFM streams
  '7soul': { tags: ['soma'] },
  'beatblender': { tags: ['soma'] },
  'bootliquor': { tags: ['soma'] },
  'bossa': { tags: ['soma', 'world'] },
  'brfm': { tags: ['soma', 'burningman'] },
  'chillits': { tags: ['soma'] },
  'christmas': { tags: ['soma'] },
  'cliqhop': { tags: ['soma', 'idm'] },
  'covers': { tags: ['soma'] },
  'darkzone': { tags: ['soma'] },
  'deepspaceone': { tags: ['soma'] },
  'defcon': { tags: ['soma'] },
  'deptstore': { tags: ['soma'] },
  'digitalis': { tags: ['soma', 'indie'] },
  'doomed': { tags: ['soma'] },
  'dronezone': { tags: ['soma'] },
  'dubstep': { tags: ['soma'] },
  'fluid': { tags: ['soma'] },
  'folkfwd': { tags: ['soma'] },
  'gsclassic': { tags: ['soma'] },
  'groovesalad': { tags: ['soma', 'indie'] },
  'illstreet': { tags: ['soma'] },
  'indiepop': { tags: ['soma', 'indie'] },
  'insound': { tags: ['soma'] },
  'jollysoul': { tags: ['soma'] },
  'live': { tags: ['soma'] },
  'lush': { tags: ['soma', 'female'] },
  'metal': { tags: ['soma'] },
  'missioncontrol': { tags: ['soma'] },
  'n5md': { tags: ['soma'] },
  'poptron': { tags: ['soma'] },
  'reggae': { tags: ['soma'] },
  'scanner': { tags: ['soma'] },
  'secretagent': { tags: ['soma'] },
  'seventies': { tags: ['soma'] },
  'sf1033': { tags: ['soma'] },
  'sfinsf': { tags: ['soma'] },
  'sonicuniverse': { tags: ['soma'] },
  'spacestation': { tags: ['soma'] },
  'specials': { tags: ['soma'] },
  'suburbsofgoa': { tags: ['soma', 'world'] },
  'synphaera': { tags: ['soma'] },
  'thetrip': { tags: ['soma'] },
  'thistle': { tags: ['soma'] },
  'tikitime': { tags: ['soma', 'world'] },
  'u80s': { tags: ['soma'] },
  'vaporwaves': { tags: ['soma'] },
  'xmasinfrisko': { tags: ['soma'] },
  'xmasrocks': { tags: ['soma'] },
  
  // Radio Paradise
  'paradise': {
    url: 'https://stream.radioparadise.com/aac-128',
    tags: ['paradise', 'US', 'rock', 'eclectic'],
    site: 'https://www.radioparadise.com/'
  },
  'paradise_mellow': {
    url: 'https://stream.radioparadise.com/mellow-128',
    tags: ['paradise', 'US', 'mellow', 'acoustic'],
    site: 'https://www.radioparadise.com/'
  },
  'paradise_rock': {
    url: 'https://stream.radioparadise.com/rock-128',
    tags: ['paradise', 'US', 'rock'],
    site: 'https://www.radioparadise.com/'
  },
  'paradise_global': {
    url: 'https://stream.radioparadise.com/global-128',
    tags: ['paradise', 'US', 'global', 'world'],
    site: 'https://www.radioparadise.com/'
  },
  'paradise_beyond': {
    url: 'https://stream.radioparadise.com/beyond-128',
    tags: ['paradise', 'US'],
    site: 'https://www.radioparadise.com/'
  },
  'paradise_serenity': {
    url: 'https://stream.radioparadise.com/serenity',
    tags: ['paradise', 'US', 'relaxation'],
    site: 'https://www.radioparadise.com/'
  },
  'paradise_2050': {
    url: 'https://stream.radioparadise.com/radio2050-128',
    tags: ['paradise', 'US', 'electronic', 'future'],
    site: 'https://www.radioparadise.com/'
  },

  // RTP - Portugal
  'antena1': {
    url: 'https://radiocast.rtp.pt/antena180a.mp3',
    tags: ['portugal', 'pt', 'public', 'news', 'variety'],
    site: 'https://www.rtp.pt/play/direto/antena1'
  },
  'antena2': {
    url: 'https://radiocast.rtp.pt/antena280a.mp3',
    tags: ['portugal', 'pt', 'public', 'classical', 'culture'],
    site: 'https://www.rtp.pt/play/direto/antena2'
  },
  'antena3': {
    url: 'https://radiocast.rtp.pt/antena380a.mp3',
    tags: ['portugal', 'pt', 'public', 'alternative', 'rock'],
    site: 'https://www.rtp.pt/play/direto/antena3'
  },

  // Concertzender - Netherlands
  'concertzender_live': {
    url: 'https://streams.greenhost.nl:8006/live',
    tags: ['concertzender', 'nl', 'classical', 'eclectic'],
    site: 'https://www.concertzender.nl/ontvangst/streamoverzicht/'
  },
  'concertzender_barok': {
    url: 'https://streams.greenhost.nl:8006/barok',
    tags: ['concertzender', 'nl', 'baroque', 'classical'],
    site: 'https://www.concertzender.nl/ontvangst/streamoverzicht/'
  },
  'concertzender_klassiek': {
    url: 'https://streams.greenhost.nl:8006/klassiek',
    tags: ['concertzender', 'nl', 'classical'],
    site: 'https://www.concertzender.nl/ontvangst/streamoverzicht/'
  },
  'concertzender_oudemuziek': {
    url: 'https://streams.greenhost.nl:8006/oudemuziek',
    tags: ['concertzender', 'nl', 'early', 'baroque'],
    site: 'https://www.concertzender.nl/ontvangst/streamoverzicht/'
  },
  'concertzender_jazz': {
    url: 'https://streams.greenhost.nl:8006/jazz',
    tags: ['concertzender', 'nl', 'jazz'],
    site: 'https://www.concertzender.nl/ontvangst/streamoverzicht/'
  },
  'concertzender_jazznotjazz': {
    url: 'https://streams.greenhost.nl:8006/jazznotjazz',
    tags: ['concertzender', 'nl', 'jazz', 'eclectic'],
    site: 'https://www.concertzender.nl/ontvangst/streamoverzicht/'
  },
  'concertzender_wereldmuziek': {
    url: 'https://streams.greenhost.nl:8006/wereldmuziek',
    tags: ['concertzender', 'nl', 'world'],
    site: 'https://www.concertzender.nl/ontvangst/streamoverzicht/'
  },

  // Traxx FM - Switzerland (multiple genre channels)
  'traxx_fm_ambient': {
    url: 'https://traxx011.ice.infomaniak.ch/traxx011-low.mp3',
    tags: ['traxx', 'ch', 'ambient', 'chill', 'switzerland'],
    site: 'https://www.allradio.net/radio/25089'
  },
  'traxx_fm_deluxe': {
    url: 'https://traxx001.ice.infomaniak.ch/traxx001-low.mp3',
    tags: ['traxx', 'ch', 'electronic', 'edm', 'switzerland'],
    site: 'https://www.allradio.net/radio/25092'
  },
  'traxx_fm_deep': {
    url: 'https://traxx013.ice.infomaniak.ch/traxx013-low.mp3',
    tags: ['traxx', 'ch', 'deep', 'house', 'switzerland'],
    site: 'https://www.allradio.net/radio/25091'
  },
  'traxx_fm_funk': {
    url: 'https://traxx016.ice.infomaniak.ch/traxx016-low.mp3',
    tags: ['traxx', 'ch', 'funk', 'switzerland'],
    site: 'https://www.allradio.net/radio/25093'
  },
  'traxx_fm_house': {
    url: 'https://traxx002.ice.infomaniak.ch/traxx002-low.mp3',
    tags: ['traxx', 'ch', 'house', 'electronic', 'switzerland'],
    site: 'https://www.allradio.net/radio/25095'
  },
  'traxx_fm_jazz': {
    url: 'https://traxx014.ice.infomaniak.ch/traxx014-low.mp3',
    tags: ['traxx', 'ch', 'jazz', 'switzerland'],
    site: 'https://www.allradio.net/radio/25096'
  },
  'traxx_fm_latino': {
    url: 'https://traxx008.ice.infomaniak.ch/traxx008-low.mp3',
    tags: ['traxx', 'ch', 'latin', 'switzerland'],
    site: 'https://www.allradio.net/radio/25097'
  },
  'traxx_fm_latino_pop': {
    url: 'https://traxx022.ice.infomaniak.ch/traxx022-1.mp3',
    tags: ['traxx', 'ch', 'latin', 'pop', 'switzerland'],
    site: 'https://www.allradio.net/radio/25099'
  },
  'traxx_fm_lounge': {
    url: 'https://traxx004.ice.infomaniak.ch/traxx004-low.mp3',
    tags: ['traxx', 'ch', 'lounge', 'chill', 'switzerland'],
    site: 'https://www.allradio.net/radio/25098'
  },
  'traxx_fm_pop': {
    url: 'https://traxx009.ice.infomaniak.ch/traxx009-low.mp3',
    tags: ['traxx', 'ch', 'pop', 'switzerland'],
    site: 'https://www.allradio.net/radio/25099'
  },
  'traxx_fm_rnb': {
    url: 'https://traxx007.ice.infomaniak.ch/traxx007-low.mp3',
    tags: ['traxx', 'ch', 'rnb', 'soul', 'switzerland'],
    site: 'https://www.allradio.net/radio/25101'
  },
  'traxx_fm_rock': {
    url: 'https://traxx019.ice.infomaniak.ch/traxx019-low.mp3',
    tags: ['traxx', 'ch', 'rock', 'switzerland'],
    site: 'https://www.allradio.net/radio/25102'
  },
  'traxx_fm_soul': {
    url: 'https://traxx006.ice.infomaniak.ch/traxx006-low.mp3',
    tags: ['traxx', 'ch', 'soul', 'switzerland'],
    site: 'https://www.allradio.net/radio/25103'
  },
  'traxx_fm_tech_minimal': {
    url: 'https://traxx020.ice.infomaniak.ch/traxx020-low.mp3',
    tags: ['traxx', 'ch', 'electronic', 'minimal', 'techno', 'switzerland'],
    site: 'https://www.allradio.net/radio/25104'
  },

  // Other Stations
  'wassoulou': {
    url: 'https://listen.radionomy.com/radio-wassoulou-internationale',
    tags: ['other', 'mali', 'africa']
  },
  'meuh': {
    url: 'https://radiomeuh.ice.infomaniak.ch/radiomeuh-128.mp3',
    tags: ['other', 'fr', 'eclectic', 'paris'],
    site: 'https://www.radiomeuh.com/'
  },
  'ambientsleepingpill': {
    url: 'https://radio.stereoscenic.com/asp-s',
    tags: ['ambient', 'sleep', 'relaxation'],
    site: 'https://ambientsleepingpill.com/'
  },
  'amambient': {
    url: 'https://radio.stereoscenic.com/ama-s',
    tags: ['ambient', 'bright', 'daytime'],
    site: 'https://amambient.com/'
  },
  'ambientmodern': {
    url: 'https://radio.stereoscenic.com/mod-s',
    tags: ['ambient', 'modern'],
    site: 'https://ambientmodern.com/'
  },
  'urbanspaceradio': {
    url: 'https://stream.urbanspaceradio.com:8443/urban-space-radio',
    site: 'https://urbanspaceradio.com/',
    tags: ['other', 'ua', 'eclectic', 'chill']
  },
  'ledjam': {
    url: 'https://stream9.xdevel.com/audio1s976748-1515/stream/icecast.audio',
    tags: ['other', 'fr', 'eclectic'],
    site: 'https://www.djam.radio/'
  },
  'cumbiasinmortales': {
    url: 'https://panel.retrolandigital.com/listen/cumbias_inmortales_radio/listen',
    tags: ['mx', 'cumbia', 'latin'],
    site: 'https://cumbiasinmortales.com/'
  },
  
  // Cuban Music
  'radio_art_cuban': {
    url: 'https://live.radioart.com/fCuban_lounge.mp3',
    tags: ['cuban', 'cuba', 'latin', 'lounge'],
    site: 'https://www.radioart.com/'
  },
  'cubania_radio': {
    url: 'https://streaming.brol.tech/rtfmlounge',
    tags: ['cuban', 'cuba', 'latin'],
    site: 'https://radiosdecuba.com/cubania/'
  },
  'cubaradio80s': {
    url: 'https://a7.asurahosting.com:7670/radio.mp3',
    tags: ['cuban', 'cuba', 'latin', '80s'],
    site: 'https://www.cuba80s.com/radio'
  },
  // Salsa Stations
  'radio_pozo_de_la_salsa': {
    url: 'https://cast4.my-control-panel.com/proxy/elpozosalsa/;',
    tags: ['latin', 'salsa'],
    site: 'https://elpozodelasalsa.com/'
  },
  'world_salsa_radio': {
    url: 'https://s4.radio.co/sc6b77aa40/listen',
    tags: ['latin', 'salsa'],
    site: 'https://worldsalsaradio.com/'
  },
  '100_por_ciento_salsa': {
    url: 'https://stm01.streammaximum.com:8194/;',
    tags: ['latin', 'salsa'],
    site: 'https://www.100porcientosalsa.com/'
  },
  'zonasalsa': {
    url: 'https://cast6.asurahosting.com/proxy/salsafou/stream',
    tags: ['latin', 'salsa'],
    site: 'http://zonsalsaradio.com/'
  },
  
  // Bachata Stations
  'latina_bachata': {
    url: 'https://latinabachata.ice.infomaniak.ch/latinabachata.mp3',
    tags: ['latin', 'bachata'],
    site: 'https://www.latina.fr/'
  },
  'top_bachata_radio': {
    url: 'https://radio.dominiserver.com/proxy/topbachata?mp=/stream',
    tags: ['latin', 'bachata'],
    site: 'https://latina104.net/top-bachata-radio/'
  },
  
  // Country & Bluegrass
  'wsm_nashville': {
    url: 'https://stream01048.westreamradio.com/wsm-am-mp3',
    tags: ['country', 'classic', 'nashville', 'US'],
    site: 'https://wsmradio.com/'
  },
  'lautfm_country': {
    url: 'https://stream.laut.fm/country',
    tags: ['country', 'de'],
    site: 'https://laut.fm/country'
  },
  'lautfm_nashville': {
    url: 'https://stream.laut.fm/nashville',
    tags: ['country', 'de'],
    site: 'https://laut.fm/nashville'
  },
  'gotradio_bluegrass': {
    url: 'http://gr01.cdnstream.com:8490/',
    tags: ['bluegrass', 'country', 'US'],
    site: 'https://www.gotradio.com/'
  },
  
  // FIP - Radio France
  'fip': {
    url: 'https://icecast.radiofrance.fr/fip-midfi.mp3?id=radiofrance',
    tags: ['fr', 'fip', 'eclectic'],
    site: 'https://www.radiofrance.fr/fip'
  },
  'fip_jazz': {
    url: 'https://icecast.radiofrance.fr/fipjazz-midfi.mp3?id=radiofrance',
    tags: ['fr', 'fip', 'jazz'],
    site: 'https://www.radiofrance.fr/fip/radio-jazz'
  },
  'fip_rock': {
    url: 'https://icecast.radiofrance.fr/fiprock-midfi.mp3?id=radiofrance',
    tags: ['fr', 'fip', 'rock'],
    site: 'https://www.radiofrance.fr/fip/radio-rock'
  },
  'fip_groove': {
    url: 'https://icecast.radiofrance.fr/fipgroove-midfi.mp3?id=radiofrance',
    tags: ['fr', 'fip', 'groove', 'soul', 'funk'],
    site: 'https://www.radiofrance.fr/fip/radio-groove'
  },
  'fip_reggae': {
    url: 'https://icecast.radiofrance.fr/fipreggae-midfi.mp3?id=radiofrance',
    tags: ['fr', 'fip', 'reggae'],
    site: 'https://www.radiofrance.fr/fip/radio-reggae'
  },
  'fip_pop': {
    url: 'https://icecast.radiofrance.fr/fippop-midfi.mp3?id=radiofrance',
    tags: ['fr', 'fip', 'pop'],
    site: 'https://www.radiofrance.fr/fip/radio-pop'
  },
  'fip_electro': {
    url: 'https://icecast.radiofrance.fr/fipelectro-midfi.mp3?id=radiofrance',
    tags: ['fr', 'fip', 'electro', 'electronic'],
    site: 'https://www.radiofrance.fr/fip/radio-electro'
  },
  'fip_monde': {
    url: 'https://icecast.radiofrance.fr/fipworld-midfi.mp3?id=radiofrance',
    tags: ['fr', 'fip', 'world'],
    site: 'https://www.radiofrance.fr/fip/radio-monde'
  },
  'fip_nouveautes': {
    url: 'https://icecast.radiofrance.fr/fipnouveautes-midfi.mp3?id=radiofrance',
    tags: ['fr', 'fip', 'nouveautes'],
    site: 'https://www.radiofrance.fr/fip/radio-nouveautes'
  },
  'fip_metal': {
    url: 'https://icecast.radiofrance.fr/fipmetal-midfi.mp3?id=radiofrance',
    tags: ['fr', 'fip', 'metal'],
    site: 'https://www.radiofrance.fr/fip/radio-metal'
  },
  'fip_hiphop': {
    url: 'https://icecast.radiofrance.fr/fiphiphop-midfi.mp3?id=radiofrance',
    tags: ['fr', 'fip', 'hiphop', 'hip-hop'],
    site: 'https://www.radiofrance.fr/fip/radio-hip-hop'
  },
  'fip_sacre_francais': {
    url: 'https://icecast.radiofrance.fr/fipsacrefrancais-midfi.mp3?id=radiofrance',
    tags: ['fr', 'fip', 'francais', 'french'],
    site: 'https://www.radiofrance.fr/fip/radio-sacre-francais'
  },
  
  // Flux FM - Berlin
  'flux_fm_techno_underground': {
    url: 'https://channels.fluxfm.de/techno-underground/externalembedflxhp/stream.mp3',
    tags: ['flux', 'techno', 'underground', 'electronic', 'berlin', 'de'],
    site: 'https://www.fluxfm.de/techno-underground'
  },
  'flux_fm_boomfm': {
    url: 'https://streams.fluxfm.de/boomfm/mp3-320/audio/',
    tags: ['flux', 'hiphop', 'rap', 'urban', 'berlin', 'de'],
    site: 'https://www.fluxfm.de/boomfm'
  },
  'flux_fm_boomfm_classics': {
    url: 'https://streams.fluxfm.de/boomfmclassics/mp3-320/audio/',
    tags: ['flux', 'hiphop', 'rap', 'classics', 'berlin', 'de'],
    site: 'https://www.fluxfm.de/boomfm'
  },
  'flux_fm_elektroflux': {
    url: 'https://streams.fluxfm.de/elektro/mp3-320/audio/',
    tags: ['flux', 'electronic', 'indie', 'berlin', 'de'],
    site: 'https://www.fluxfm.de'
  },
  'flux_fm_clubsandwich': {
    url: 'https://streams.fluxfm.de/clubsandwich/mp3-320/audio/',
    tags: ['flux', 'electronic', 'house', 'techno', 'berlin', 'de'],
    site: 'https://www.fluxfm.de/clubsandwich'
  },
  'flux_fm_sound_of_berlin': {
    url: 'https://streams.fluxfm.de/soundofberlin/mp3-320/audio/',
    tags: ['flux', 'electronic', 'techno', 'berlin', 'de'],
    site: 'https://www.fluxfm.de/sound-of-berlin'
  },
  'flux_fm_berlin_beach_house': {
    url: 'https://streams.fluxfm.de/bbeachhouse/mp3-320/audio/',
    tags: ['flux', 'electronic', 'house', 'chill', 'berlin', 'de'],
    site: 'https://www.fluxfm.de'
  },
  'flux_fm_john_reed': {
    url: 'https://streams.fluxfm.de/john-reed/mp3-320/audio/',
    tags: ['flux', 'electronic', 'hiphop', 'techno', 'berlin', 'de'],
    site: 'https://www.fluxfm.de'
  },
  'flux_fm_klubradio': {
    url: 'https://streams.fluxfm.de/klubradio/mp3-320/audio/',
    tags: ['flux', 'dance', 'club', 'berlin', 'de'],
    site: 'https://www.fluxfm.de'
  },
  'flux_fm_chillhop': {
    url: 'https://streams.fluxfm.de/Chillhop/mp3-320/streams.fluxfm.de/',
    tags: ['flux', 'lofi', 'chillhop', 'beats', 'berlin', 'de'],
    site: 'https://www.fluxfm.de'
  },
  'flux_fm_fluxforward': {
    url: 'https://streams.fluxfm.de/forward/mp3-320/audio/',
    tags: ['flux', 'indie', 'alternative', 'berlin', 'de'],
    site: 'https://www.fluxfm.de'
  },
  'flux_fm_fluxkompensator': {
    url: 'https://streams.fluxfm.de/fluxkompensator/mp3-320/audio/',
    tags: ['flux', 'alternative', 'indie', 'berlin', 'de'],
    site: 'https://www.fluxfm.de'
  },
  'flux_fm_lounge': {
    url: 'https://streams.fluxfm.de/lounge/mp3-320/audio/',
    tags: ['flux', 'chill', 'lounge', 'berlin', 'de'],
    site: 'https://www.fluxfm.de'
  },
  'flux_fm_hippie_trippy_garden_pretty': {
    url: 'https://streams.fluxfm.de/event02/mp3-320/radiode/',
    tags: ['flux', 'psychedelic', 'electronic', 'experimental', 'berlin', 'de'],
    site: 'https://www.fluxfm.de'
  },
  'flux_fm_rasta_radio': {
    url: 'https://streams.fluxfm.de/rastaradio/mp3-320/streams.fluxfm.de/',
    tags: ['flux', 'reggae', 'dub', 'berlin', 'de'],
    site: 'https://www.fluxfm.de'
  },
  'flux_fm_dub_radio': {
    url: 'https://streams.fluxfm.de/dubradio/mp3-320/streams.fluxfm.de/',
    tags: ['flux', 'dub', 'reggae', 'berlin', 'de'],
    site: 'https://www.fluxfm.de'
  },
  'flux_fm_fluxrap': {
    url: 'https://streams.fluxfm.de/rap/mp3-320/streams.fluxfm.de/',
    tags: ['flux', 'rap', 'hiphop', 'berlin', 'de'],
    site: 'https://www.fluxfm.de'
  },
  'flux_fm_metal': {
    url: 'https://streams.fluxfm.de/metalfm/mp3-320/radiode/',
    tags: ['flux', 'metal', 'hardrock', 'berlin', 'de'],
    site: 'https://www.fluxfm.de'
  },
  'flux_fm_hard_rock': {
    url: 'https://streams.fluxfm.de/hardrock/mp3-320/streams.fluxfm.de/',
    tags: ['flux', 'hardrock', 'rock', 'berlin', 'de'],
    site: 'https://www.fluxfm.de'
  },
  'flux_fm_b_funk': {
    url: 'https://streams.fluxfm.de/event01/mp3-320/streams.fluxfm.de/',
    tags: ['flux', 'funk', 'soul', 'berlin', 'de'],
    site: 'https://www.fluxfm.de'
  },
  'flux_fm_hot_rnb': {
    url: 'https://streams.fluxfm.de/rnb/mp3-320/streams.fluxfm.de/',
    tags: ['flux', 'rnb', 'soul', 'berlin', 'de'],
    site: 'https://www.fluxfm.de'
  },
  'flux_fm_jazzradio_schwarzenstein': {
    url: 'https://streams.fluxfm.de/jazzschwarz/mp3-320/audio/',
    tags: ['flux', 'jazz', 'berlin', 'de'],
    site: 'https://www.fluxfm.de'
  },
  'flux_fm_xjazz': {
    url: 'https://streams.fluxfm.de/xjazz/mp3-320/audio/',
    tags: ['flux', 'jazz', 'berlin', 'de'],
    site: 'https://www.fluxfm.de'
  },
  'flux_fm_neofm': {
    url: 'https://streams.fluxfm.de/neofm/mp3-320/radiode/',
    tags: ['flux', 'neoclassical', 'berlin', 'de'],
    site: 'https://www.fluxfm.de'
  },
  'flux_fm_jaegermusic': {
    url: 'https://streams.fluxfm.de/studio56/mp3-320/audio/',
    tags: ['flux', 'electronic', 'indie', 'berlin', 'de'],
    site: 'https://www.fluxfm.de'
  },
  'flux_fm_70er': {
    url: 'https://streams.fluxfm.de/70er/mp3-320/audio/',
    tags: ['flux', '70s', 'classic', 'berlin', 'de'],
    site: 'https://www.fluxfm.de'
  },
  'flux_fm_80er': {
    url: 'https://streams.fluxfm.de/80er/mp3-320/streams.fluxfm.de/',
    tags: ['flux', '80s', 'classic', 'berlin', 'de'],
    site: 'https://www.fluxfm.de'
  },
  'flux_fm_60er': {
    url: 'https://streams.fluxfm.de/60er/mp3-320/streams.fluxfm.de/',
    tags: ['flux', '60s', 'classic', 'berlin', 'de'],
    site: 'https://www.fluxfm.de'
  },
  
  // RadioJAZZ.FM
  // 'radiojazz': {
  //   url: 'http://radiojazz.fm:8000/',
  //   tags: ['jazz', 'poland'],
  //   site: 'https://radiojazz.fm/'
  // },
  
  // Radio Zinzine
  // 'radiozinzine': {
  //   url: 'http://live.francra.org:8000/radiozinzine',
  //   tags: ['fr', 'associative', 'alternative'],
  //   site: 'https://www.radiozinzine.org/'
  // },
  
  // Radio Grenouille
  // 'radiogrenouille': {
  //   url: 'http://live.francra.org:8000/radiogrenouille',
  //   tags: ['fr', 'marseille', 'cultural'],
  //   site: 'https://www.radiogrenouille.com/'
  // },
  
  // Radio Canut
  // 'radiocanut': {
  //   url: 'http://live.francra.org:8000/radiocanut',
  //   tags: ['fr', 'lyon', 'alternative'],
  //   site: 'https://www.radiocanut.org/'
  // },
  
  // Radio Libertaire
  // 'radiolibertaire': {
  //   url: 'http://live.francra.org:8000/radiolibertaire',
  //   tags: ['fr', 'paris', 'anarchist'],
  //   site: 'https://www.radio-libertaire.net/'
  // },
  
  // Radio Campus Lille
  // 'radiocampuslille': {
  //   url: 'http://live.francra.org:8000/radiocampuslille',
  //   tags: ['fr', 'lille', 'student'],
  //   site: 'https://www.campuslille.com/'
  // },
  
  // Couleur 3
  // 'couleur3': {
  //   url: 'https://stream.srg-ssr.ch/m/couleur3/mp3_128',
  //   tags: ['ch', 'switzerland', 'alternative'],
  //   site: 'https://www.rts.ch/couleur3/'
  // },
  
  // Neringa FM
  // 'neringa': {
  //   url: 'http://streamer.midiaudio.com:80/neringa',
  //   tags: ['lt', 'eclectic', 'chill'],
  //   site: 'https://www.neringafm.lt/'
  // },
  
  // Vikerraadio
  // 'vikerraadio': {
  //   url: 'https://icecast.err.ee/vikerraadio',
  //   tags: ['ee', 'estonia', 'news'],
  //   site: 'https://vikerraadio.err.ee/'
  // }
};

// Channel sections configuration
// Each section defines:
//   - name: Display name for the section
//   - tags: Array of tags to filter channels (channel must have at least one matching tag)
//   - order: Display order (lower numbers appear first)
const sections = [
  {
    name: 'Other Stations',
    tags: ['other'],
    order: 9
  },
  {
    name: 'Country',
    tags: ['country'],
    order: 11
  },
  {
    name: 'Latin',
    tags: ['latin'],
    order: 10
  },
  {
    name: 'Radio Paradise',
    tags: ['paradise'],
    order: 8
  },
  {
    name: 'SomaFM',
    tags: ['soma'],
    order: 3
  },
  {
    name: 'FIP',
    tags: ['fip'],
    order: 4
  },
  {
    name: 'Flux FM',
    tags: ['flux'],
    order: 6
  },
  {
    name: 'Traxx FM',
    tags: ['traxx'],
    order: 5
  },
  {
    name: 'Portugal',
    tags: ['portugal'],
    order: 2
  },
  {
    name: 'Concertzender',
    tags: ['concertzender'],
    order: 7
  },
  {
    name: 'AMBIENT',
    tags: ['ambient'],
    order: 1
  }
];

// Broken channels (for reference - commented out in channels.coffee.md)
// These channels failed connection tests and are kept here for potential future fixes
// const brokenChannels = {
  // 'chillstep.info': { url: 'http://chillstep.info:1984/listen.ogg', tags: ['dubstep', 'chill'] },
  // 'pmr': { url: 'http://pmr.lt/streams/pmr-2', tags: ['lt', 'eclectic', 'chill', 'world'], site: 'http://pmr.lt/en' },
  // 'neringa': { url: 'http://streamer.midiaudio.com:80/ner', tags: ['lt', 'eclectic', 'chill'], site: 'http://www.neringafm.lt/' },
  // 'bbcworld': { url: 'http://bbcwssc.ic.llnwd.net/stream/bbcwssc_mp1_ws-eieuk', tags: ['uk', 'news'] },
  // 'radiopanik': { url: 'http://streaming.domainepublic.net:8000/radiopanik.ogg', tags: ['libre', 'bxl', 'be'] },
  // 'radioairlibre': { url: 'http://streaming.domainepublic.net:8000/radioairlibre.ogg', tags: ['libre', 'bxl', 'be'] },
  // 'radiocampusbxl': { url: 'http://streamer.radiocampusbruxelles.org:8000/stream.ogg', tags: ['bxl', 'be'] },
  // 'couleur3': { url: 'http://stream.srg-ssr.ch/m/couleur3/mp3_128', tags: ['ch'] },
  // 'amazing': { url: 'http://109.74.195.10:8000', pls: 'http://stream.amazingradio.com:8000/listen.pls', site: 'http://amazingradio.com/' }
// };

function hostFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch (_) {
    return '';
  }
}

const BRAND_HOST_BY_TAG = Object.freeze({
  paradise: 'radioparadise.com',
  fip: 'radiofrance.fr',
  portugal: 'rtp.pt',
  concertzender: 'concertzender.nl',
  traxx: 'traxx.fm',
  flux: 'fluxfm.de'
});

const PARADISE_ID_TO_STREAM_NAME = Object.freeze({
  paradise: 'main-mix',
  paradise_mellow: 'mellow',
  paradise_rock: 'rock',
  paradise_global: 'global',
  paradise_beyond: 'beyond',
  paradise_serenity: 'serenity',
  paradise_2050: 'radio2050'
});

function googleFaviconUrl(host) {
  return 'https://www.google.com/s2/favicons?domain=' + encodeURIComponent(host) + '&sz=128';
}

function brandHostFromTags(tags) {
  if (!Array.isArray(tags)) return '';
  for (let i = 0; i < tags.length; i += 1) {
    const mapped = BRAND_HOST_BY_TAG[tags[i]];
    if (mapped) return mapped;
  }
  return '';
}

function deriveChannelImageUrl(id, info) {
  const tags = Array.isArray(info.tags) ? info.tags : [];
  if (tags.includes('soma')) {
    // somafm.com/img3/{id}-400.jpg often 404s as HTML and triggers ORB in Chromium.
    // Real URLs come from https://api.somafm.com/channels.json (see index.html).
    return null;
  }
  const brandHost = brandHostFromTags(tags);
  if (brandHost) return googleFaviconUrl(brandHost);
  if (info.site) {
    const host = hostFromUrl(info.site);
    if (host) return googleFaviconUrl(host);
  }
  if (info.url) {
    const host = hostFromUrl(info.url);
    if (host) return googleFaviconUrl(host);
  }
  return 'https://api.dicebear.com/9.x/shapes/svg?seed=' + encodeURIComponent(id);
}

function dispatchChannelArtworkRefresh() {
  if (typeof window === 'undefined' || typeof window.dispatchEvent !== 'function') return;
  window.dispatchEvent(new CustomEvent('radiostr-channel-artwork'));
  window.dispatchEvent(new CustomEvent('radiostr-somafm-artwork'));
}

function primaryUrlFromArtwork(artwork) {
  if (typeof artwork === 'string' && artwork.trim()) return artwork.trim();
  if (Array.isArray(artwork) && artwork.length) {
    const first = artwork[0];
    if (first && typeof first.src === 'string' && first.src.trim()) return first.src.trim();
  }
  return null;
}

// Ensure every channel has a stable image URL for UI usage.
// Explicit `img` wins; else `artwork` (string or [{ src, sizes?, type? }]); else derived default.
Object.entries(channels).forEach(([id, info]) => {
  if (!info || typeof info !== 'object') return;
  if (info.img) return;
  const fromArtwork = primaryUrlFromArtwork(info.artwork);
  if (fromArtwork) {
    info.img = fromArtwork;
    return;
  }
  const derived = deriveChannelImageUrl(id, info);
  if (derived) info.img = derived;
});

(function hydrateSomaFmArtwork() {
  if (typeof fetch === 'undefined') return;
  fetch('https://api.somafm.com/channels.json')
    .then((res) => {
      if (!res.ok) throw new Error('soma channels');
      return res.json();
    })
    .then((data) => {
      const list = data && Array.isArray(data.channels) ? data.channels : [];
      const byId = Object.create(null);
      list.forEach((ch) => {
        if (!ch || !ch.id) return;
        const u = ch.largeimage || ch.image;
        if (u && String(u).trim()) byId[ch.id] = String(u).trim();
      });
      let any = false;
      Object.entries(channels).forEach(([id, info]) => {
        if (!info || typeof info !== 'object') return;
        const tags = Array.isArray(info.tags) ? info.tags : [];
        if (!tags.includes('soma')) return;
        const soma = list.find((ch) => ch && ch.id === id);
        if (soma && soma.title) info.name = String(soma.title).trim();
        const u = byId[id];
        if (u) {
          info.img = u;
          any = true;
        }
      });
      if (any) dispatchChannelArtworkRefresh();
    })
    .catch(() => {});
})();

(function hydrateRadioParadiseArtwork() {
  if (typeof fetch === 'undefined') return;
  const paradiseIds = Object.keys(channels).filter((id) => {
    const info = channels[id];
    return info && Array.isArray(info.tags) && info.tags.includes('paradise');
  });
  if (!paradiseIds.length) return;

  fetch('https://api.radioparadise.com/api/list_chan')
    .then((res) => {
      if (!res.ok) throw new Error('radioparadise channels');
      return res.json();
    })
    .then((list) => {
      if (!Array.isArray(list)) return;
      const byStream = Object.create(null);
      list.forEach((ch) => {
        if (!ch) return;
        const stream = ch.stream_name || ch.slug;
        const image = ch.image;
        if (stream && image && String(image).trim()) {
          byStream[String(stream).trim()] = String(image).trim();
        }
      });
      let any = false;
      paradiseIds.forEach((id) => {
        const info = channels[id];
        const streamName = PARADISE_ID_TO_STREAM_NAME[id];
        if (!streamName) return;
        const imageUrl = byStream[streamName];
        if (imageUrl) {
          info.img = imageUrl;
          any = true;
        }
        const meta = list.find(
          (ch) => ch && (ch.stream_name === streamName || ch.slug === streamName)
        );
        if (meta && meta.title) info.name = String(meta.title).trim();
      });
      if (any) dispatchChannelArtworkRefresh();
    })
    .catch(() => {});
})();

if (typeof window !== 'undefined') {
  window.RADIOSTR_CHANNELS = channels;
  window.RADIOSTR_SECTIONS = sections;
}
