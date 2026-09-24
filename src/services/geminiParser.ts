/**
 * 避難指示テキスト構造化解析サービス (Gemini 3.1 Flash-Lite API & 高精度ローカルNLP)
 */

export interface ParsedEvacuationAlert {
  issuingAuthority: string;
  alertLevel: number;
  alertLevelText: string;
  alertType: string;
  disasterTypes: string[];
  disasterTypeText: string;
  targetDistricts: string[];
  hazardCondition: string;
  effectiveTime: string;
  recommendedAction: string;
  parseMethod: 'gemini' | 'local_nlp';
  modelUsed?: string;
  apiError?: string;
  rawResponse?: any;
  isEntireArea?: boolean;
  shelters?: string[];
}

/**
 * ローカルNLP解析エンジン（オフライン・APIキーなしでも即時高精度パース）
 */
export function parseEvacuationTextLocally(text: string): ParsedEvacuationAlert {
  const cleanText = text.trim();

  // 1. 発令自治体抽出
  let authority = '横浜市';

  // 文末や文中の括弧表記（例: （熱海市）、(横浜市)、〔中区〕）
  const endParenMatch = cleanText.match(/[（(〔]([一-龠ぁ-んァ-ヶ]+(?:都|道|府|県|市|区|町|村))[)）〕]/);
  // 横浜市〔中区〕 のような複合パターンの検出
  const compositeMatch = cleanText.match(/([一-龠ぁ-んァ-ヶ]+(?:都|道|府|県|市))[\s　]*[〔\[（(]([一-龠ぁ-んァ-ヶ]+(?:区|市|町|村))[〕\]）)]/);

  if (compositeMatch) {
    authority = `${compositeMatch[1]}${compositeMatch[2]}`;
  } else if (endParenMatch) {
    authority = endParenMatch[1];
  } else {
    const authorityMatch = cleanText.match(/(?:こちらは|役所|役場|市役所|区役所|本部|現在、)?([一-龠ぁ-んァ-ヶ]+(?:都|道|府|県)?(?:[一-龠ぁ-んァ-ヶ]+(?:市|区|町|村)))/);
    if (authorityMatch) {
      authority = authorityMatch[1];
    } else if (cleanText.includes('熱海')) {
      authority = '静岡県熱海市';
    } else if (cleanText.includes('横浜市')) {
      authority = cleanText.includes('中区') ? '横浜市中区' : '横浜市';
    } else if (cleanText.includes('北区')) {
      authority = '東京都北区';
    } else if (cleanText.includes('鎌倉')) {
      authority = '神奈川県鎌倉市';
    }
  }

  // 1.5. 市内全域判定
  const isEntireArea = /(?:市内全域|市全域|町内全域|村内全域|区内全域|管内全域|全域に|全域へ|全域で)/.test(cleanText);

  // 1.6. 開設避難所リスト抽出（例: 開設している避難所は、泉小中学校・伊豆山小学校...）
  const shelters: string[] = [];
  const shelterMatch = cleanText.match(/開設(?:している)?避難所[は:：\s]*([^\n。]+)/);
  if (shelterMatch) {
    const rawList = shelterMatch[1].split(/[・、,/\s]/);
    for (const item of rawList) {
      const s = item.trim().replace(/(?:など|等|です)$/, '');
      if (s.length >= 2 && !shelters.includes(s)) {
        shelters.push(s);
      }
    }
  }

  // 2. 警戒レベル判定
  let level = 4;
  let levelText = '警戒レベル4（避難指示）';
  if (/レベル5|緊急安全確保/.test(cleanText)) {
    level = 5;
    levelText = '警戒レベル5（緊急安全確保・直ちに命を守る行動）';
  } else if (/レベル4|避難指示|避難勧告|土砂災害危険警報/.test(cleanText)) {
    level = 4;
    levelText = cleanText.includes('土砂災害危険警報')
      ? '警戒レベル4相当（土砂災害危険警報）'
      : '警戒レベル4（避難指示・全員避難）';
  } else if (/レベル3|高齢者等避難/.test(cleanText)) {
    level = 3;
    levelText = '警戒レベル3（高齢者等避難）';
  }

  // 3. 災害種別抽出
  const disasterTypes: string[] = [];
  let disasterTypeText = '';
  
  const hasLandslide = /土砂|急傾斜|崖|がけ崩れ|地すべり|土石流/.test(cleanText);
  const hasFlood = /内水|浸水|冠水|下水|道路冠水/.test(cleanText);
  const hasRiver = /氾濫|河川|河川水位|堤防/.test(cleanText);

  if (hasLandslide) {
    disasterTypes.push('landslide');
  }
  if (hasFlood) {
    disasterTypes.push('flood');
  }
  if (hasRiver) {
    disasterTypes.push('river_flood');
  }

  if (hasLandslide && hasFlood) {
    disasterTypeText = '土砂災害 ＆ 都市浸水（複合災害）';
  } else if (hasLandslide) {
    disasterTypeText = '土砂災害（急傾斜地崩壊・即時避難）';
  } else if (hasFlood) {
    disasterTypeText = '内水氾濫・都市浸水（下水逆流・道路冠水）';
  } else if (hasRiver) {
    disasterTypeText = '河川洪水（氾濫危険水位超過）';
  } else {
    disasterTypes.push('general_disaster');
    disasterTypeText = '風水害・気象災害警戒';
  }

  // 4. 対象町丁字・エリア名抽出（〔 〕, （ ）, [ ] 対応）
  const districts: string[] = [];
  const excludeWords = ['警戒レベル', 'レベル', '避難指示', '緊急速報', '全員避難', '高齢者等避難', '土砂災害', '大雨危険警報', '浸水想定', '横浜市', '一部地域', '即時避難', '即時避難対象区域', '対象地域', '避難指示の対象地域'];

  // 発表市町村パターン: 「発表市町村：横浜南部、鎌倉」
  const muniMatch = cleanText.match(/発表市町村\s*[:：]\s*([^(\n（]+)/);
  if (muniMatch) {
    const parts = muniMatch[1].split(/[・、,]/);
    for (const p of parts) {
      const t = p.trim();
      if (t && !districts.includes(t)) {
        districts.push(t);
      }
    }
  }

  // 亀甲括弧〔〕、丸括弧（）、角括弧［］を網羅
  const bracketMatches = cleanText.matchAll(/[（(\[〔]([^）)\]〕]+)[）)\]〕]/g);
  for (const match of bracketMatches) {
    const inner = match[1].trim();
    if (excludeWords.some(w => inner === w)) continue;
    if (inner.includes('警戒レベル')) continue;

    // 読点（、）、中黒（・）、カンマで分割
    const candidateParts = inner.split(/[・、,]/);
    for (const part of candidateParts) {
      const trimmed = part
        .replace(/(?:等|の急傾斜地|近傍|周辺|地区|低地|および|含む|の一部).*/, '')
        .trim();
      if (trimmed.length >= 2 && trimmed.length <= 15 && !excludeWords.some(w => trimmed === w)) {
        if (!districts.includes(trimmed)) {
          districts.push(trimmed);
        }
      }
    }
  }

  // テキスト全体からの既知町丁マッチング（横浜市および汎用）
  const knownPlaces = ['山手町', '元町', '石川町', '北方町', '山下町', '本牧', '新山下', '中華街', '赤羽', '志茂', '岩淵町'];
  for (const place of knownPlaces) {
    if (cleanText.includes(place) && !districts.includes(place)) {
      districts.push(place);
    }
  }

  // 5. 避難条件・ハザード条件
  let hazardCondition = '指定危険区域全域';
  if (cleanText.includes('即時避難対象区域')) {
    hazardCondition = '土砂災害危険警報発表に伴う即時避難対象区域（急傾斜地崩壊危険箇所）';
  } else if (/浸水深(?:0\.5m|50cm|1m)/.test(cleanText)) {
    hazardCondition = '想定浸水深 0.5m〜1.0m以上の低地・浸水想定区域';
  } else if (/急傾斜地|崖|土砂災害警戒区域|土砂災害危険警報/.test(cleanText)) {
    hazardCondition = '急傾斜地崩壊危険箇所・土砂災害警戒区域（崖地近傍）';
  }

  // 6. 推奨アクション
  let recommendedAction = '安全な避難所または建物の高層階へ退避してください。';
  if (/垂直避難|2階以上|垂直退避/.test(cleanText)) {
    recommendedAction = '屋外移動は極めて危険。堅牢な建物の2階以上へ緊急垂直退避！';
  } else if (/立ち退き避難/.test(cleanText)) {
    recommendedAction = '浸水前または安全なルートで指定避難所へ立ち退き避難。';
  } else if (hasLandslide) {
    recommendedAction = '崖・急斜面から直ちに離隔し、山と反対側の2階以上へ退避。';
  }

  // 7. 発令時刻
  let effectiveTime = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  const timeMatch = cleanText.match(/(\d{1,2})時(\d{1,2})分/);
  if (timeMatch) {
    effectiveTime = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2].padStart(2, '0')}`;
  }

  const finalDistricts = isEntireArea
    ? (districts.length > 0 ? districts : ['市内全域'])
    : (districts.length > 0 ? districts : ['管内全域または指定警戒区域']);

  return {
    issuingAuthority: authority,
    alertLevel: level,
    alertLevelText: levelText,
    alertType: '避難指示',
    disasterTypes,
    disasterTypeText,
    targetDistricts: finalDistricts,
    hazardCondition,
    effectiveTime,
    recommendedAction,
    parseMethod: 'local_nlp',
    isEntireArea,
    shelters
  };
}

/**
 * 旧世代モデル（2.5系, 1.5系, 2.0系など）を安全に gemini-3.1-flash-lite へ自動マイグレーション
 */
export function sanitizeModelName(model?: string): string {
  if (!model || model.trim() === '') return 'gemini-3.1-flash-lite';
  const m = model.trim().toLowerCase();
  if (m.includes('2.5') || m.includes('1.5') || m.includes('2.0')) {
    return 'gemini-3.1-flash-lite';
  }
  return model.trim();
}

/**
 * Gemini 3.1 Flash-Lite API による構造化解析
 * 公式最安値モデル（gemini-3.1-flash-lite）を最優先で呼び出し、
 * 状況に応じて現行の Gemini 3.x 系列（gemini-3.5-flash-lite, gemini-3.8-flash）またはローカルNLPへ安全にフォールバックします。
 */
export async function parseEvacuationTextWithGemini(
  text: string,
  apiKey: string,
  preferredModel: string = 'gemini-3.1-flash-lite'
): Promise<ParsedEvacuationAlert> {
  const trimmedKey = (apiKey || '').trim();
  if (!trimmedKey) {
    // APIキーがない場合はローカルNLPへフォールバック
    return parseEvacuationTextLocally(text);
  }

  const safeModel = sanitizeModelName(preferredModel);

  // 試行するモデル候補順（最安値の gemini-3.1-flash-lite を最優先、次に 3.5-flash-lite、3.8-flash）
  const candidateModels = Array.from(
    new Set([
      safeModel,
      'gemini-3.1-flash-lite',
      'gemini-3.5-flash-lite',
      'gemini-3.8-flash'
    ])
  ).filter(Boolean);

  const prompt = `あなたは防災危機管理の専門NLPシステムです。以下の自治体緊急速報メール（エリアメール/Lアラート）のテキストを解析し、指定のJSONフォーマットのみを返してください。前置きやMarkdownコードブロック記号は一切含めず、純粋なJSONオブジェクトのみを出力してください。

【テキスト】
${text}

【出力JSONスキーマ】
{
  "issuingAuthority": "発令自治体名（例: 静岡県熱海市、神奈川県横浜市中区）",
  "alertLevel": 4, // 警戒レベルの数値 (3, 4, 5)
  "alertLevelText": "警戒レベル4（避難指示）",
  "alertType": "避難指示",
  "disasterTypes": ["landslide", "flood", "river_flood のいずれか1つ以上"],
  "disasterTypeText": "自然言語での災害種別（例: 土砂災害危険警報・大雨警報、急傾斜地崩壊）",
  "isEntireArea": true, // 「市内全域」「全域」などの自治体全域発令の場合 true、一部町丁のみの場合は false
  "targetDistricts": ["抽出された町丁・地域名リスト（全域の場合は ['市内全域']）"],
  "shelters": ["開設されている避難所名リスト（例: 泉小中学校, 熱海中学校。無ければ []）"],
  "hazardCondition": "避難発令基準条件（例: 浸水深0.5m以上、急傾斜地近傍等）",
  "effectiveTime": "発令時刻（テキスト内の表記、無ければ現在時刻 HH:mm）",
  "recommendedAction": "住民が今すぐとるべき具体的な推奨避難行動"
}`;

  let lastErrorMessage = '';

  for (const model of candidateModels) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${trimmedKey}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            responseMimeType: "application/json"
          }
        })
      });

      if (!response.ok) {
        let errDetail = `HTTP ${response.status} (${response.statusText})`;
        try {
          const errJson = await response.json();
          if (errJson?.error?.message) {
            errDetail = `HTTP ${response.status}: ${errJson.error.message}`;
          }
        } catch (_) {}

        lastErrorMessage = errDetail;
        console.warn(`Gemini API call failed for model [${model}]: ${errDetail}`);

        // 404 (Model not found) または 400 の場合は別モデル候補を試行
        if (response.status === 404 || response.status === 400) {
          continue;
        } else {
          // 403 (API Key invalid / quota) 等は全モデルで共通の可能性が高いため一旦ループ継続
          continue;
        }
      }

      const data = await response.json();
      const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!candidateText) {
        throw new Error(`Gemini API [${model}] returned empty content.`);
      }

      const cleanJson = candidateText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      return {
        issuingAuthority: parsed.issuingAuthority || '横浜市',
        alertLevel: Number(parsed.alertLevel) || 4,
        alertLevelText: parsed.alertLevelText || '警戒レベル4（避難指示）',
        alertType: parsed.alertType || '避難指示',
        disasterTypes: Array.isArray(parsed.disasterTypes) && parsed.disasterTypes.length > 0
          ? parsed.disasterTypes
          : ['landslide'],
        disasterTypeText: parsed.disasterTypeText || '土砂・浸水災害警戒',
        targetDistricts: Array.isArray(parsed.targetDistricts) ? parsed.targetDistricts : [],
        hazardCondition: parsed.hazardCondition || '警戒区域全域',
        effectiveTime: parsed.effectiveTime || '14:00',
        recommendedAction: parsed.recommendedAction || '直ちに安全な場所へ避難してください。',
        parseMethod: 'gemini',
        modelUsed: model,
        rawResponse: data,
        isEntireArea: Boolean(parsed.isEntireArea) || (Array.isArray(parsed.targetDistricts) && parsed.targetDistricts.some((d: any) => String(d).includes('全域'))),
        shelters: Array.isArray(parsed.shelters) ? parsed.shelters : []
      };
    } catch (err: any) {
      lastErrorMessage = err?.message || String(err);
      console.warn(`Error attempting Gemini model ${model}:`, err);
    }
  }

  // すべてのモデルで失敗した場合はローカルNLPへフォールバックし、失敗理由を付与
  console.warn('All Gemini models failed. Falling back to Local NLP. Reason:', lastErrorMessage);
  const localResult = parseEvacuationTextLocally(text);
  localResult.apiError = lastErrorMessage || 'Gemini API接続失敗';
  return localResult;
}

/**
 * Gemini API 疎通テスト用ヘルパー
 * 指定モデル（デフォルト: gemini-3.1-flash-lite）に対して直接疎通テストを実施
 */
export async function testGeminiConnection(
  apiKey: string,
  modelName: string = 'gemini-3.1-flash-lite'
): Promise<{ success: boolean; model: string; message: string; statusCode?: number }> {
  const trimmedKey = (apiKey || '').trim();
  const targetModel = sanitizeModelName(modelName);

  if (!trimmedKey) {
    return { success: false, model: targetModel, message: 'APIキーが入力されていません。' };
  }

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${trimmedKey}`;
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: 'ping' }]
          }
        ]
      })
    });

    if (response.ok) {
      return {
        success: true,
        model: targetModel,
        message: `接続成功 (HTTP 200 OK) - モデル: ${targetModel}`,
        statusCode: 200
      };
    }

    let errMessage = `HTTP ${response.status} (${response.statusText})`;
    try {
      const errJson = await response.json();
      if (errJson?.error?.message) {
        errMessage = errJson.error.message;
      }
    } catch (_) {}

    return {
      success: false,
      model: targetModel,
      message: `接続エラー (HTTP ${response.status}): ${errMessage}`,
      statusCode: response.status
    };
  } catch (err: any) {
    return {
      success: false,
      model: targetModel,
      message: `通信エラー: ${err?.message || String(err)}`
    };
  }
}
