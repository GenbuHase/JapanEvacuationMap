/**
 * 電文構造化結果に基づく動的エリア描画サービス
 * 国土地理院ジオコーダーAPI / Nominatim / Turf.js による完全動的ポリゴン生成
 */
import * as turf from '@turf/turf';
import type { ParsedEvacuationAlert } from './geminiParser';

export interface DynamicGeoResult {
  geoJson: any;
  center: [number, number]; // [lat, lng]
  bounds: [[number, number], [number, number]]; // Leaflet LatLngBoundsExpression
  matchedDistricts: string[];
  source: 'mlit_gsi' | 'nominatim' | 'synthetic';
}

/**
 * 国土地理院 住所検索APIによる町丁ジオコーディング
 */
async function geocodeWithGSI(query: string): Promise<[number, number] | null> {
  try {
    const url = `https://msearch.gsi.go.jp/address-search/AddressSearch?q=${encodeURIComponent(query)}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.length > 0) {
      const [lng, lat] = data[0].geometry.coordinates;
      return [lat, lng];
    }
  } catch (e) {
    console.warn('GSI geocode error:', e);
  }
  return null;
}

/**
 * OpenStreetMap Nominatim APIによる行政・町丁ポリゴン検索
 */
async function fetchBoundaryWithNominatim(query: string): Promise<any | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=geojson&polygon_geojson=1&countrycodes=jp&limit=1`;
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'EvacuationMapDX/2.0'
      }
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.features && data.features.length > 0) {
      const feat = data.features[0];
      if (feat.geometry && (feat.geometry.type === 'Polygon' || feat.geometry.type === 'MultiPolygon')) {
        return feat;
      }
    }
  } catch (e) {
    console.warn('Nominatim boundary error:', e);
  }
  return null;
}

let jisCache: Record<string, { prefecture: string; city: string }> | null = null;

/**
 * 国土数値情報（国土交通省）を元にした「海岸線で区切られた陸地のみの行政界GeoJSON」を取得
 * ※ OSM Nominatim は海上の領海・海域境界（相模湾など沖合20km）まで含むため、
 *    国土数値情報ベースの陸地境界を最優先で取得して海上の誤描画を防止します。
 */
async function fetchLandBoundaryFromMlit(authority: string): Promise<any[] | null> {
  try {
    if (!jisCache) {
      const res = await fetch('https://geolonia.github.io/jisx0402/api/v1/all.json');
      if (res.ok) {
        jisCache = await res.json();
      }
    }
    if (!jisCache) return null;

    const cleanAuth = authority.replace(/^(?:こちらは|現在、)/, '').trim();
    let targetCode: string | null = null;

    for (const [code, info] of Object.entries(jisCache)) {
      const fullName = `${info.prefecture}${info.city}`;
      if (cleanAuth === fullName || cleanAuth === info.city || fullName.includes(cleanAuth) || cleanAuth.includes(fullName)) {
        targetCode = code;
        break;
      }
    }

    if (!targetCode) {
      for (const [code, info] of Object.entries(jisCache)) {
        if (cleanAuth.includes(info.city) && info.city.length >= 3) {
          targetCode = code;
          break;
        }
      }
    }

    if (!targetCode) return null;

    const prefCode = targetCode.slice(0, 2);
    const city5 = targetCode.slice(0, 5);

    const geoUrl = `https://geolonia.github.io/japanese-admins/${prefCode}/${city5}.json`;
    const geoRes = await fetch(geoUrl);
    if (!geoRes.ok) return null;

    const geoData = await geoRes.json();
    if (geoData && geoData.features && geoData.features.length > 0) {
      return geoData.features;
    }
  } catch (e) {
    console.warn('MLIT land boundary fetch error:', e);
  }
  return null;
}

/**
 * 構造化された避難電文から、ハザードポリゴンを動的に生成・取得する
 * @param parsed 電文の構造化結果
 */
export async function generateDynamicHazardGeoJson(
  parsed: ParsedEvacuationAlert
): Promise<DynamicGeoResult> {
  const authority = parsed.issuingAuthority || '横浜市';
  const districts = parsed.targetDistricts && parsed.targetDistricts.length > 0
    ? parsed.targetDistricts
    : ['中心部'];
  const isFlood = parsed.disasterTypes.includes('flood') || parsed.disasterTypes.includes('river_flood');
  const isLandslide = parsed.disasterTypes.includes('landslide');

  const features: any[] = [];
  const districtCoords: Array<[number, number]> = [];
  const matchedDistricts: string[] = [];

  const isEntire = Boolean(parsed.isEntireArea) || districts.some(d => d.includes('全域'));

  // A. 市内全域・自治体全域発令の場合（国土数値情報の正確な陸地境界ポリゴンを最優先取得）
  if (isEntire) {
    // 1. 国土数値情報（海岸線で区切られた陸域のみの行政界データ）の取得を最優先試行
    const landFeatures = await fetchLandBoundaryFromMlit(authority);
    if (landFeatures && landFeatures.length > 0) {
      for (const feat of landFeatures) {
        feat.properties = {
          ...(feat.properties || {}),
          name: `${authority} 全域 (${parsed.disasterTypeText})`,
          hazardType: isFlood ? 'flood' : 'landslide',
          categoryText: `${parsed.hazardCondition} - 市内全域避難指示（国土数値情報 陸地行政境界）`,
          dangerLevel: parsed.alertLevel || 4,
          isEntireArea: true,
          color: isFlood ? '#ef4444' : '#f59e0b',
          fillColor: isFlood ? '#e11d48' : '#d97706',
          fillOpacity: 0.35
        };
        features.push(feat);
      }
      matchedDistricts.push(`${authority}全域`);
    } else {
      // 2. 国土数値情報が取れなかった場合のフォールバック（Nominatim）
      let boundaryFeat = await fetchBoundaryWithNominatim(authority);
      if (!boundaryFeat && !authority.includes('都') && !authority.includes('県')) {
        boundaryFeat = await fetchBoundaryWithNominatim(`日本 ${authority}`);
      }

      if (boundaryFeat) {
        boundaryFeat.properties = {
          name: `${authority} 全域 (${parsed.disasterTypeText})`,
          hazardType: isFlood ? 'flood' : 'landslide',
          categoryText: `${parsed.hazardCondition} - 市内全域一括避難指示`,
          dangerLevel: parsed.alertLevel || 4,
          isEntireArea: true,
          color: isFlood ? '#ef4444' : '#f59e0b',
          fillColor: isFlood ? '#e11d48' : '#d97706',
          fillOpacity: 0.35
        };
        features.push(boundaryFeat);
        matchedDistricts.push(`${authority}全域`);
      } else {
        // 3. 役所座標を核とした市域広域バッファ（半径5.5km）の動的合成
        const authCoords = await geocodeWithGSI(authority) || [35.1000, 139.0700];
        const [lat, lng] = authCoords;
        const centerPt = turf.point([lng, lat]);
        const wideBuffered = turf.buffer(centerPt, 5.5, { units: 'kilometers', steps: 32 });
        if (wideBuffered) {
          wideBuffered.properties = {
            name: `${authority} 全域警戒エリア`,
            hazardType: isFlood ? 'flood' : 'landslide',
            categoryText: `${parsed.hazardCondition} - 広域避難指示`,
            dangerLevel: parsed.alertLevel || 4,
            isEntireArea: true,
            color: isFlood ? '#ef4444' : '#f59e0b',
            fillColor: isFlood ? '#e11d48' : '#d97706',
            fillOpacity: 0.35
          };
          features.push(wideBuffered);
          matchedDistricts.push(`${authority}全域`);
        }
      }
    }
  } else {
    // B. 個別町丁指定の場合
    for (const district of districts) {
      const fullQuery = `${authority} ${district}`.trim();
      
      // 1. Nominatimでポリゴン境界の直接取得を試行
      const boundaryFeat = await fetchBoundaryWithNominatim(fullQuery);
      if (boundaryFeat) {
        boundaryFeat.properties = {
          name: `${district} (${parsed.disasterTypeText})`,
          hazardType: isFlood ? 'flood' : 'landslide',
          categoryText: `${parsed.hazardCondition} - 避難指示対象`,
          dangerLevel: parsed.alertLevel || 4,
          color: isFlood ? '#ef4444' : '#f59e0b',
          fillColor: isFlood ? '#e11d48' : '#d97706',
          fillOpacity: 0.45
        };
        features.push(boundaryFeat);
        matchedDistricts.push(district);
        
        const bbox = turf.bbox(boundaryFeat);
        districtCoords.push([(bbox[1] + bbox[3]) / 2, (bbox[0] + bbox[2]) / 2]);
        continue;
      }

      // 2. 国土地理院APIで中心座標を特定し、地勢・町丁バッファポリゴンを動的合成
      const coords = await geocodeWithGSI(fullQuery) || await geocodeWithGSI(district);
      if (coords) {
        const [lat, lng] = coords;
        districtCoords.push([lat, lng]);
        matchedDistricts.push(district);

        const centerPt = turf.point([lng, lat]);
        const bufferDistKm = isFlood ? 0.6 : 0.35;
        const buffered = turf.buffer(centerPt, bufferDistKm, { units: 'kilometers', steps: 16 });

        if (buffered) {
          buffered.properties = {
            name: `${district} ${parsed.disasterTypeText}区域`,
            hazardType: isFlood ? 'flood' : 'landslide',
            categoryText: `${parsed.hazardCondition}（動的ジオコーディング照会）`,
            dangerLevel: parsed.alertLevel || 4,
            color: isFlood ? '#ef4444' : '#f59e0b',
            fillColor: isFlood ? '#e11d48' : '#d97706',
            fillOpacity: 0.45
          };
          features.push(buffered);
        }
      }
    }
  }

  // C. 開設避難所（shelters）の国土地理院ジオコーディング＆Pointプロット
  if (parsed.shelters && parsed.shelters.length > 0) {
    for (const shelter of parsed.shelters) {
      const q = `${authority} ${shelter}`;
      const sCoords = await geocodeWithGSI(q) || await geocodeWithGSI(shelter);
      if (sCoords) {
        const [lat, lng] = sCoords;
        const shelterPt = turf.point([lng, lat], {
          type: 'shelter',
          name: shelter,
          categoryText: '開設避難所（安全受入施設）',
          dangerLevel: 0,
          color: '#10b981',
          fillColor: '#10b981'
        });
        features.push(shelterPt);
      }
    }
  }

  // 1つもマッチしなかった場合のフォールバック（自治体名そのもので検索）
  if (features.length === 0) {
    const authCoords = await geocodeWithGSI(authority) || [35.4428, 139.6453];
    const [lat, lng] = authCoords;
    districtCoords.push([lat, lng]);
    const centerPt = turf.point([lng, lat]);
    const buffered = turf.buffer(centerPt, 0.8, { units: 'kilometers', steps: 20 });
    if (buffered) {
      buffered.properties = {
        name: `${authority} 避難指示対象エリア`,
        hazardType: isFlood ? 'flood' : 'landslide',
        categoryText: `${parsed.hazardCondition}`,
        dangerLevel: parsed.alertLevel || 4,
        color: isFlood ? '#ef4444' : '#f59e0b',
        fillColor: isFlood ? '#e11d48' : '#d97706',
        fillOpacity: 0.45
      };
      features.push(buffered);
    }
  }

  const featureCollection = {
    type: "FeatureCollection",
    features
  };

  // 全体のバウンディングボックスと中心座標を算出
  const overallBbox = turf.bbox(featureCollection);
  const centerLat = (overallBbox[1] + overallBbox[3]) / 2;
  const centerLng = (overallBbox[0] + overallBbox[2]) / 2;

  const bounds: [[number, number], [number, number]] = [
    [overallBbox[1], overallBbox[0]],
    [overallBbox[3], overallBbox[2]]
  ];

  return {
    geoJson: featureCollection,
    center: [centerLat, centerLng],
    bounds,
    matchedDistricts,
    source: features[0]?.id ? 'nominatim' : 'mlit_gsi'
  };
}
