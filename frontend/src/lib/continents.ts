/** Maps each country name in `public/countries-110m.json` (Natural Earth /
 * world-atlas) to one of the five traditional continents, for the map's
 * decorative per-continent fill. Anything not listed (e.g. Antarctica, a few
 * disputed-territory slivers) falls back to a neutral grey in the component. */
export const COUNTRY_CONTINENT: Record<string, string> = {
  // Asia
  Afghanistan: 'asia', Armenia: 'asia', Azerbaijan: 'asia', Bangladesh: 'asia', Bhutan: 'asia',
  Brunei: 'asia', Cambodia: 'asia', China: 'asia', Cyprus: 'asia', Georgia: 'asia', India: 'asia',
  Indonesia: 'asia', Iran: 'asia', Iraq: 'asia', Israel: 'asia', Japan: 'asia', Jordan: 'asia',
  Kazakhstan: 'asia', Kuwait: 'asia', Kyrgyzstan: 'asia', Laos: 'asia', Lebanon: 'asia',
  Malaysia: 'asia', Mongolia: 'asia', Myanmar: 'asia', 'N. Cyprus': 'asia', Nepal: 'asia',
  'North Korea': 'asia', Oman: 'asia', Pakistan: 'asia', Palestine: 'asia', Philippines: 'asia',
  Qatar: 'asia', 'Saudi Arabia': 'asia', 'South Korea': 'asia', 'Sri Lanka': 'asia', Syria: 'asia',
  Taiwan: 'asia', Tajikistan: 'asia', Thailand: 'asia', 'Timor-Leste': 'asia', Turkey: 'asia',
  Turkmenistan: 'asia', 'United Arab Emirates': 'asia', Uzbekistan: 'asia', Vietnam: 'asia', Yemen: 'asia',

  // Europe
  Albania: 'europe', Austria: 'europe', Belarus: 'europe', Belgium: 'europe',
  'Bosnia and Herz.': 'europe', Bulgaria: 'europe', Croatia: 'europe', Czechia: 'europe',
  Denmark: 'europe', Estonia: 'europe', Finland: 'europe', France: 'europe', Germany: 'europe',
  Greece: 'europe', Hungary: 'europe', Iceland: 'europe', Ireland: 'europe', Italy: 'europe',
  Kosovo: 'europe', Latvia: 'europe', Lithuania: 'europe', Luxembourg: 'europe',
  Macedonia: 'europe', Moldova: 'europe', Montenegro: 'europe', Netherlands: 'europe',
  Norway: 'europe', Poland: 'europe', Portugal: 'europe', Romania: 'europe', Russia: 'europe',
  Serbia: 'europe', Slovakia: 'europe', Slovenia: 'europe', Spain: 'europe', Sweden: 'europe',
  Switzerland: 'europe', Ukraine: 'europe', 'United Kingdom': 'europe',

  // Africa
  Algeria: 'africa', Angola: 'africa', Benin: 'africa', Botswana: 'africa',
  'Burkina Faso': 'africa', Burundi: 'africa', Cameroon: 'africa', 'Central African Rep.': 'africa',
  Chad: 'africa', Congo: 'africa', "Côte d'Ivoire": 'africa', 'Dem. Rep. Congo': 'africa',
  Djibouti: 'africa', Egypt: 'africa', 'Eq. Guinea': 'africa', Eritrea: 'africa', Ethiopia: 'africa',
  Gabon: 'africa', Gambia: 'africa', Ghana: 'africa', Guinea: 'africa', 'Guinea-Bissau': 'africa',
  Kenya: 'africa', Lesotho: 'africa', Liberia: 'africa', Libya: 'africa', Madagascar: 'africa',
  Malawi: 'africa', Mali: 'africa', Mauritania: 'africa', Morocco: 'africa', Mozambique: 'africa',
  Namibia: 'africa', Niger: 'africa', Nigeria: 'africa', Rwanda: 'africa', 'S. Sudan': 'africa',
  Senegal: 'africa', 'Sierra Leone': 'africa', Somalia: 'africa', Somaliland: 'africa',
  'South Africa': 'africa', Sudan: 'africa', Tanzania: 'africa', Togo: 'africa', Tunisia: 'africa',
  Uganda: 'africa', 'W. Sahara': 'africa', Zambia: 'africa', Zimbabwe: 'africa', eSwatini: 'africa',

  // Americas (North + South, traditionally one continent in the "five")
  Argentina: 'americas', Bahamas: 'americas', Belize: 'americas', Bolivia: 'americas',
  Brazil: 'americas', Canada: 'americas', Chile: 'americas', Colombia: 'americas',
  'Costa Rica': 'americas', Cuba: 'americas', 'Dominican Rep.': 'americas', Ecuador: 'americas',
  'El Salvador': 'americas', 'Falkland Is.': 'americas', Greenland: 'americas', Guatemala: 'americas',
  Guyana: 'americas', Haiti: 'americas', Honduras: 'americas', Jamaica: 'americas', Mexico: 'americas',
  Nicaragua: 'americas', Panama: 'americas', Paraguay: 'americas', Peru: 'americas',
  'Puerto Rico': 'americas', Suriname: 'americas', 'Trinidad and Tobago': 'americas',
  'United States of America': 'americas', Uruguay: 'americas', Venezuela: 'americas',

  // Oceania
  Australia: 'oceania', Fiji: 'oceania', 'New Caledonia': 'oceania', 'New Zealand': 'oceania',
  'Papua New Guinea': 'oceania', 'Solomon Is.': 'oceania', Vanuatu: 'oceania',
}

export const CONTINENT_FILL: Record<string, string> = {
  asia: 'rgba(242, 193, 78, 0.14)',
  europe: 'rgba(110, 198, 255, 0.14)',
  africa: 'rgba(224, 122, 95, 0.14)',
  americas: 'rgba(129, 178, 154, 0.14)',
  oceania: 'rgba(179, 157, 219, 0.16)',
  // A neutral mid-tone rather than white-based — a white overlay barely
  // shows on the dark theme's near-black canvas and vanishes entirely on
  // the light theme's already-light canvas.
  other: 'rgba(120, 130, 138, 0.12)',
}

export const CONTINENT_FILL_HOVER: Record<string, string> = {
  asia: 'rgba(242, 193, 78, 0.32)',
  europe: 'rgba(110, 198, 255, 0.32)',
  africa: 'rgba(224, 122, 95, 0.32)',
  americas: 'rgba(129, 178, 154, 0.32)',
  oceania: 'rgba(179, 157, 219, 0.34)',
  other: 'rgba(79, 209, 197, 0.16)',
}
