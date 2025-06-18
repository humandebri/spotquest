/**
 * 統一地域名マッピングユーティリティ
 * 地域コードから日本語表示名への変換を一元管理
 */

// 国コードから日本語国名へのマッピング
const COUNTRY_NAMES: { [key: string]: string } = {
  'JP': '日本',
  'US': 'アメリカ',
  'CA': 'カナダ',
  'GB': 'イギリス',
  'FR': 'フランス',
  'DE': 'ドイツ',
  'IT': 'イタリア',
  'ES': 'スペイン',
  'NL': 'オランダ',
  'BE': 'ベルギー',
  'CH': 'スイス',
  'AT': 'オーストリア',
  'NO': 'ノルウェー',
  'DK': 'デンマーク',
  'FI': 'フィンランド',
  'SE': 'スウェーデン',
  'CN': '中国',
  'KR': '韓国',
  'TH': 'タイ',
  'AU': 'オーストラリア',
  'BR': 'ブラジル',
  'AR': 'アルゼンチン',
  'MX': 'メキシコ',
  'IN': 'インド',
  'ID': 'インドネシア',
  'MY': 'マレーシア',
  'SG': 'シンガポール',
  'PH': 'フィリピン',
  'VN': 'ベトナム',
  'RU': 'ロシア',
  'UA': 'ウクライナ',
  'PL': 'ポーランド',
  'CZ': 'チェコ',
  'HU': 'ハンガリー',
  'RO': 'ルーマニア',
  'GR': 'ギリシャ',
  'TR': 'トルコ',
  'IL': 'イスラエル',
  'EG': 'エジプト',
  'ZA': '南アフリカ',
  'NG': 'ナイジェリア',
  'KE': 'ケニア',
  'MA': 'モロッコ',
  'XX': 'その他',
};

// 地域コードから日本語地域名へのマッピング
const REGION_NAMES: { [key: string]: string } = {
  // 日本の都道府県（ISO 3166-2:JP）
  'JP-01': '北海道',
  'JP-02': '青森',
  'JP-03': '岩手',
  'JP-04': '宮城',
  'JP-05': '秋田',
  'JP-06': '山形',
  'JP-07': '福島',
  'JP-08': '茨城',
  'JP-09': '栃木',
  'JP-10': '群馬',
  'JP-11': '埼玉',
  'JP-12': '千葉',
  'JP-13': '東京',
  'JP-14': '神奈川',
  'JP-15': '新潟',
  'JP-16': '富山',
  'JP-17': '石川',
  'JP-18': '福井',
  'JP-19': '山梨',
  'JP-20': '長野',
  'JP-21': '岐阜',
  'JP-22': '静岡',
  'JP-23': '愛知',
  'JP-24': '三重',
  'JP-25': '滋賀',
  'JP-26': '京都',
  'JP-27': '大阪',
  'JP-28': '兵庫',
  'JP-29': '奈良',
  'JP-30': '和歌山',
  'JP-31': '鳥取',
  'JP-32': '島根',
  'JP-33': '岡山',
  'JP-34': '広島',
  'JP-35': '山口',
  'JP-36': '徳島',
  'JP-37': '香川',
  'JP-38': '愛媛',
  'JP-39': '高知',
  'JP-40': '福岡',
  'JP-41': '佐賀',
  'JP-42': '長崎',
  'JP-43': '熊本',
  'JP-44': '大分',
  'JP-45': '宮崎',
  'JP-46': '鹿児島',
  'JP-47': '沖縄',

  // アメリカの州（主要なもの）
  'US-CA': 'カリフォルニア',
  'US-NY': 'ニューヨーク',
  'US-TX': 'テキサス',
  'US-FL': 'フロリダ',
  'US-IL': 'イリノイ',
  'US-PA': 'ペンシルベニア',
  'US-OH': 'オハイオ',
  'US-GA': 'ジョージア',
  'US-NC': 'ノースカロライナ',
  'US-MI': 'ミシガン',
  'US-NJ': 'ニュージャージー',
  'US-VA': 'バージニア',
  'US-WA': 'ワシントン',
  'US-AZ': 'アリゾナ',
  'US-MA': 'マサチューセッツ',
  'US-TN': 'テネシー',
  'US-IN': 'インディアナ',
  'US-MO': 'ミズーリ',
  'US-MD': 'メリーランド',
  'US-WI': 'ウィスコンシン',
  'US-CO': 'コロラド',
  'US-MN': 'ミネソタ',
  'US-SC': 'サウスカロライナ',
  'US-AL': 'アラバマ',
  'US-LA': 'ルイジアナ',
  'US-KY': 'ケンタッキー',
  'US-OR': 'オレゴン',
  'US-OK': 'オクラホマ',
  'US-CT': 'コネチカット',
  'US-UT': 'ユタ',
  'US-IA': 'アイオワ',
  'US-NV': 'ネバダ',
  'US-AR': 'アーカンソー',
  'US-MS': 'ミシシッピ',
  'US-KS': 'カンザス',
  'US-NM': 'ニューメキシコ',
  'US-NE': 'ネブラスカ',
  'US-WV': 'ウェストバージニア',
  'US-ID': 'アイダホ',
  'US-HI': 'ハワイ',
  'US-NH': 'ニューハンプシャー',
  'US-ME': 'メイン',
  'US-MT': 'モンタナ',
  'US-RI': 'ロードアイランド',
  'US-DE': 'デラウェア',
  'US-SD': 'サウスダコタ',
  'US-ND': 'ノースダコタ',
  'US-AK': 'アラスカ',
  'US-VT': 'バーモント',
  'US-WY': 'ワイオミング',

  // カナダの州・準州
  'CA-ON': 'オンタリオ',
  'CA-QC': 'ケベック',
  'CA-BC': 'ブリティッシュコロンビア',
  'CA-AB': 'アルバータ',
  'CA-MB': 'マニトバ',
  'CA-SK': 'サスカチュワン',
  'CA-NS': 'ノバスコシア',
  'CA-NB': 'ニューブランズウィック',
  'CA-NL': 'ニューファンドランド・ラブラドール',
  'CA-PE': 'プリンスエドワードアイランド',
  'CA-NT': 'ノースウェスト準州',
  'CA-NU': 'ヌナブト準州',
  'CA-YT': 'ユーコン準州',

  // オーストラリアの州・特別地域
  'AU-NSW': 'ニューサウスウェールズ',
  'AU-VIC': 'ビクトリア',
  'AU-QLD': 'クイーンズランド',
  'AU-WA': '西オーストラリア',
  'AU-SA': '南オーストラリア',
  'AU-TAS': 'タスマニア',
  'AU-NT': 'ノーザンテリトリー',
  'AU-ACT': 'オーストラリア首都特別地域',

  // ドイツの州
  'DE-BY': 'バイエルン',
  'DE-BW': 'バーデン・ヴュルテンベルク',
  'DE-NW': 'ノルトライン・ヴェストファーレン',
  'DE-HE': 'ヘッセン',
  'DE-NI': 'ニーダーザクセン',
  'DE-RP': 'ラインラント・プファルツ',
  'DE-BE': 'ベルリン',
  'DE-SH': 'シュレースヴィヒ・ホルシュタイン',
  'DE-BB': 'ブランデンブルク',
  'DE-SN': 'ザクセン',
  'DE-TH': 'テューリンゲン',
  'DE-ST': 'ザクセン・アンハルト',
  'DE-MV': 'メクレンブルク・フォアポンメルン',
  'DE-SL': 'ザールラント',
  'DE-HB': 'ブレーメン',
  'DE-HH': 'ハンブルク',

  // イギリスの構成国
  'GB-ENG': 'イングランド',
  'GB-SCT': 'スコットランド',
  'GB-WLS': 'ウェールズ',
  'GB-NIR': '北アイルランド',

  // フランスの地域圏（主要なもの）
  'FR-IDF': 'イル・ド・フランス',
  'FR-ARA': 'オーヴェルニュ・ローヌ・アルプ',
  'FR-HDF': 'オー・ド・フランス',
  'FR-OCC': 'オクシタニー',
  'FR-NAQ': 'ヌーヴェル・アキテーヌ',
  'FR-GES': 'グラン・テスト',
  'FR-PDL': 'ペイ・ド・ラ・ロワール',
  'FR-NOR': 'ノルマンディー',
  'FR-BFC': 'ブルゴーニュ・フランシュ・コンテ',
  'FR-BRE': 'ブルターニュ',
  'FR-CVL': 'サントル・ヴァル・ド・ロワール',
  'FR-COR': 'コルシカ',
  'FR-PAC': 'プロヴァンス・アルプ・コート・ダジュール',

  // デフォルト
  'XX-XX': 'その他',
};

/**
 * 国コードから日本語国名を取得
 * @param countryCode 国コード（例: 'JP', 'US'）
 * @returns 日本語国名、未対応の場合は国コードをそのまま返す
 */
export function getCountryName(countryCode: string): string {
  if (!countryCode) return 'その他';
  
  const name = COUNTRY_NAMES[countryCode.toUpperCase()];
  return name || countryCode;
}

/**
 * 地域コードから日本語地域名を取得
 * @param regionCode 地域コード（例: 'JP-13', 'US-CA'）
 * @returns 日本語地域名、未対応の場合は英語名または地域コードを返す
 */
export function getRegionName(regionCode: string): string {
  if (!regionCode) return 'その他';
  
  // 完全一致を試行
  const exactMatch = REGION_NAMES[regionCode.toUpperCase()];
  if (exactMatch) return exactMatch;
  
  // 部分一致を試行（JP-13A のような拡張コードに対応）
  const baseCode = regionCode.replace(/[A-Z]+$/, '');
  const partialMatch = REGION_NAMES[baseCode.toUpperCase()];
  if (partialMatch) return partialMatch;
  
  // 数値コードの場合、対応する地域名を推測
  const match = regionCode.match(/^([A-Z]{2})-(\d+)$/);
  if (match) {
    const [, country, number] = match;
    const numericCode = parseInt(number, 10);
    
    // 日本の場合は都道府県番号として解釈
    if (country === 'JP' && numericCode >= 1 && numericCode <= 47) {
      const jpCode = `JP-${numericCode.toString().padStart(2, '0')}`;
      const jpName = REGION_NAMES[jpCode];
      if (jpName) return jpName;
    }
    
    // その他の国の場合は「地域 N」として表示
    const countryName = getCountryName(country);
    return `${countryName} 地域 ${number}`;
  }
  
  // フォールバック: 地域コードをそのまま返す
  return regionCode;
}

/**
 * 国コードと地域コードから表示用文字列を生成
 * @param countryCode 国コード
 * @param regionCode 地域コード  
 * @returns 「国名 / 地域名」形式の文字列
 */
export function formatRegionDisplay(countryCode?: string, regionCode?: string): string {
  const country = getCountryName(countryCode || 'XX');
  const region = getRegionName(regionCode || 'XX-XX');
  
  // 地域名が国名と同じ場合は重複を避ける
  if (region === country) {
    return country;
  }
  
  return `${country} / ${region}`;
}

/**
 * 利用可能な地域名マッピングを取得（デバッグ用）
 * @returns 地域コードから地域名へのマッピングオブジェクト
 */
export function getAvailableRegions(): { [key: string]: string } {
  return { ...REGION_NAMES };
}

/**
 * 利用可能な国名マッピングを取得（デバッグ用）
 * @returns 国コードから国名へのマッピングオブジェクト
 */
export function getAvailableCountries(): { [key: string]: string } {
  return { ...COUNTRY_NAMES };
}