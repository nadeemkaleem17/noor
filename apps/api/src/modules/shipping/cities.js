// The city master list the checkout offers (plan/09-data-model/09 section 4.1, Q-09.9-1): Pakistani cities and towns by province, a few
// alternate spellings for the checkout search, and the cities listed first. Staff add to it from the admin; the seed only inserts what is missing.

/** @type {Record<string, string[]>} */
const byProvince = {
  Punjab: [
    'Lahore', 'Faisalabad', 'Rawalpindi', 'Multan', 'Gujranwala', 'Sialkot', 'Bahawalpur', 'Sargodha', 'Sheikhupura', 'Jhang', 'Gujrat', 'Kasur',
    'Rahim Yar Khan', 'Sahiwal', 'Okara', 'Wah Cantonment', 'Dera Ghazi Khan', 'Mianwali', 'Kamoke', 'Burewala', 'Jhelum', 'Sadiqabad', 'Khanewal',
    'Hafizabad', 'Muzaffargarh', 'Khanpur', 'Chiniot', 'Mandi Bahauddin', 'Attock', 'Vehari', 'Chakwal', 'Gojra',
    'Bhakkar', 'Layyah', 'Toba Tek Singh', 'Pakpattan', 'Narowal', 'Lodhran', 'Bahawalnagar', 'Khushab', 'Rajanpur', 'Hasilpur', 'Arifwala', 'Jaranwala',
    'Murree', 'Taxila', 'Kamalia', 'Haroonabad', 'Chishtian', 'Daska', 'Wazirabad', 'Muridke', 'Pattoki', 'Ferozewala', 'Shorkot', 'Mailsi', 'Bhalwal',
    'Kot Addu', 'Samundri', 'Jauharabad', 'Chunian', 'Phalia', 'Pir Mahal', 'Renala Khurd', 'Nankana Sahib', 'Ahmedpur East', 'Minchinabad', 'Kharian',
    'Sambrial', 'Pasrur', 'Gujar Khan', 'Sohawa', 'Dina', 'Pindi Gheb', 'Fateh Jang', 'Talagang', 'Lalamusa', 'Malakwal', 'Sillanwali', 'Bhera',
    'Shahpur', 'Kot Radha Kishan', 'Dunyapur', 'Jalalpur Jattan', 'Tandlianwala', 'Pindi Bhattian', 'Liaquatpur',
    'Yazman', 'Shakargarh', 'Zafarwal', 'Ghakhar', 'Kahuta',
  ],
  Sindh: [
    'Karachi', 'Hyderabad', 'Sukkur', 'Larkana', 'Nawabshah', 'Mirpur Khas', 'Jacobabad', 'Shikarpur', 'Khairpur', 'Dadu', 'Thatta', 'Badin', 'Tando Allahyar',
    'Tando Adam', 'Tando Muhammad Khan', 'Jamshoro', 'Kotri', 'Sanghar', 'Umerkot', 'Ghotki', 'Kandhkot', 'Kashmore', 'Matiari', 'Hala', 'Moro',
    'Rohri', 'Mehar', 'Shahdadpur', 'Sehwan', 'Digri', 'Naushahro Feroze', 'Kambar', 'Ratodero', 'Gambat', 'Pano Aqil', 'Daharki', 'Mithi', 'Khipro',
    'Johi', 'Kunri', 'Jati', 'Sujawal', 'Golarchi', 'Ubauro', 'Dokri', 'Tharparkar', 'Nasirabad', 'Sakrand',
  ],
  'Khyber Pakhtunkhwa': [
    'Peshawar', 'Mardan', 'Mingora', 'Abbottabad', 'Kohat', 'Dera Ismail Khan', 'Swabi', 'Nowshera', 'Charsadda', 'Mansehra', 'Bannu', 'Haripur', 'Chitral',
    'Timergara', 'Hangu', 'Karak', 'Lakki Marwat', 'Battagram', 'Buner', 'Tank', 'Kalam', 'Batkhela', 'Dargai', 'Havelian', 'Risalpur', 'Parachinar',
    'Alpuri', 'Thall', 'Shabqadar', 'Tangi', 'Pabbi', 'Jehangira', 'Topi', 'Ghazi', 'Oghi', 'Balakot', 'Matta', 'Madyan', 'Landi Kotal',
    'Bara', 'Miranshah', 'Wana',
  ],
  Balochistan: [
    'Quetta', 'Gwadar', 'Turbat', 'Khuzdar', 'Sibi', 'Chaman', 'Zhob', 'Loralai', 'Dera Murad Jamali', 'Hub', 'Dera Allah Yar', 'Usta Muhammad', 'Panjgur',
    'Kharan', 'Nushki', 'Mastung', 'Kalat', 'Pishin', 'Qila Saifullah', 'Qila Abdullah', 'Lasbela', 'Bela', 'Jaffarabad', 'Kech', 'Awaran', 'Dalbandin',
    'Ormara', 'Pasni', 'Taftan', 'Harnai',
  ],
  'Islamabad Capital Territory': ['Islamabad', 'Bhara Kahu', 'Tarnol', 'Golra Sharif'],
  'Azad Jammu and Kashmir': [
    'Muzaffarabad', 'Mirpur', 'Kotli', 'Bagh', 'Rawalakot', 'Bhimber', 'Pallandri', 'Sudhnoti', 'Neelum', 'Haveli', 'Dadyal', 'Athmuqam', 'Forward Kahuta',
    'Hattian Bala',
  ],
  'Gilgit-Baltistan': ['Gilgit', 'Skardu', 'Hunza', 'Chilas', 'Ghizer', 'Astore', 'Diamer', 'Ghanche', 'Khaplu', 'Shigar', 'Nagar', 'Aliabad'],
}

/** Cities listed first in the checkout combobox. */
const major = new Set(['Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan', 'Peshawar', 'Quetta', 'Hyderabad', 'Gujranwala', 'Sialkot'])

/** Other spellings people type. */
/** @type {Record<string, string[]>} */
const aliases = {
  Faisalabad: ['Lyallpur'],
  Rawalpindi: ['Pindi'],
  Lahore: ['Lahor'],
  Karachi: ['Khi'],
  Hyderabad: ['Hyderabad Sindh'],
  Peshawar: ['Pishawar'],
  Mingora: ['Swat', 'Saidu Sharif'],
  Nawabshah: ['Shaheed Benazirabad'],
  'Dera Ismail Khan': ['DI Khan', 'D.I. Khan'],
  'Dera Ghazi Khan': ['DG Khan', 'D.G. Khan'],
  'Rahim Yar Khan': ['RYK'],
  'Mirpur Khas': ['Mirpurkhas'],
  'Wah Cantonment': ['Wah Cantt', 'Wah'],
  Sheikhupura: ['Sheikhupura City', 'Shaikhupura'],
  Gujranwala: ['Gujranwala City'],
  Sargodha: ['Sargoda'],
  Kasur: ['Qasur'],
  'Toba Tek Singh': ['TT Singh'],
  Gwadar: ['Gawadar'],
  Muzaffarabad: ['Muzafarabad'],
  Abbottabad: ['Abbotabad'],
  Gilgit: ['Gilgit City'],
}

/** @typedef {{ name: string, province: string, aliases: string[], isMajor: boolean }} CitySeed */

/** @type {CitySeed[]} */
export const citySeeds = Object.entries(byProvince).flatMap(([province, names]) =>
  names.map((name) => ({ name, province, aliases: aliases[name] ?? [], isMajor: major.has(name) })),
)
