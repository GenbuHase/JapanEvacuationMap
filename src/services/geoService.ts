/**
 * 空間幾何判定 ＆ 国交省オープンデータ連携サービス (Turf.js / Leaflet)
 */
import * as turf from '@turf/turf';

export type HazardIntersectionStatus = 'INSIDE' | 'NEARBY' | 'OUTSIDE';

export interface SpatialAnalysisResult {
  status: HazardIntersectionStatus;
  distanceToNearestMeters: number;
  hitFeatures: Array<{
    name: string;
    hazardType: string;
    categoryText: string;
    dangerLevel: number;
  }>;
  nearestFeature: {
    name: string;
    hazardType: string;
    categoryText: string;
    distanceMeters: number;
    nearestPoint: [number, number]; // [lat, lng]
  } | null;
  hudMessage: {
    badge: string;
    badgeVariant: 'danger' | 'warning' | 'safe';
    title: string;
    description: string;
    action: string;
  };
}

/**
 * ユーザー座標と危険区域GeoJSONの空間内外判定（Point-in-Polygon & 最短距離計算）
 * @param userLat ユーザー緯度
 * @param userLng ユーザー経度
 * @param geoJson 危険ポリゴンのFeatureCollection
 * @param nearbyThresholdMeters 近接警戒とみなす半径（デフォルト350m）
 */
export function analyzeUserHazardSpatialIntersection(
  userLat: number,
  userLng: number,
  geoJson: any,
  nearbyThresholdMeters: number = 350
): SpatialAnalysisResult {
  const userPt = turf.point([userLng, userLat]);
  const hitFeatures: Array<any> = [];
  let minDistanceMeters = Infinity;
  let nearestFeatureInfo: any = null;

  if (!geoJson || !geoJson.features || geoJson.features.length === 0) {
    return {
      status: 'OUTSIDE',
      distanceToNearestMeters: Infinity,
      hitFeatures: [],
      nearestFeature: null,
      hudMessage: {
        badge: '警戒区域外',
        badgeVariant: 'safe',
        title: '現在地は指定避難指示区域の対象外です',
        description: '現在、周囲に差し迫った危険ポリゴンは検出されていません。ただし気象の急変には引き続き注意してください。',
        action: '周囲の安全確認と情報収集の継続'
      }
    };
  }

  // 1. 各ポリゴンとの内外判定＆距離計測
  for (const feature of geoJson.features) {
    if (!feature.geometry) continue;

    // 避難所などのPoint/LineStringフィーチャーはポリゴン内外判定・境界距離測定から除外
    if (feature.geometry.type !== 'Polygon' && feature.geometry.type !== 'MultiPolygon') {
      continue;
    }

    // ポリゴン内部判定 (Point-in-Polygon)
    const isInside = turf.booleanPointInPolygon(userPt, feature);

    if (isInside) {
      hitFeatures.push({
        name: feature.properties?.name || '指定危険区域',
        hazardType: feature.properties?.hazardType || 'general',
        categoryText: feature.properties?.categoryText || '',
        dangerLevel: feature.properties?.dangerLevel || 4
      });
    }

    // ポリゴン外周ラインを取り出して最短距離を測定
    try {
      const line = turf.polygonToLine(feature);
      // feature が MultiPolygon または FeatureCollection の場合
      const lines = line.type === 'FeatureCollection' ? line.features : [line];

      for (const singleLine of lines) {
        // turf.pointToLineDistance はデフォルトでキロメートルを返す
        const distKm = turf.pointToLineDistance(userPt, singleLine as any, { units: 'kilometers' });
        const distM = distKm * 1000;

        if (distM < minDistanceMeters) {
          minDistanceMeters = distM;

          // 最も近いライン上の最近接点
          const nearestPtOnLine = turf.nearestPointOnLine(singleLine as any, userPt);
          const [nLng, nLat] = nearestPtOnLine.geometry.coordinates;

          nearestFeatureInfo = {
            name: feature.properties?.name || '近接危険区域',
            hazardType: feature.properties?.hazardType || 'general',
            categoryText: feature.properties?.categoryText || '',
            distanceMeters: Math.round(distM),
            nearestPoint: [nLat, nLng] as [number, number]
          };
        }
      }
    } catch (e) {
      console.warn('Distance calculation error on feature:', e);
    }
  }

  // 2. 状態判定とHUDメッセージ生成
  if (hitFeatures.length > 0) {
    // 直撃！
    const primary = hitFeatures[0];
    const isFlood = primary.hazardType === 'flood';
    return {
      status: 'INSIDE',
      distanceToNearestMeters: 0,
      hitFeatures,
      nearestFeature: nearestFeatureInfo,
      hudMessage: {
        badge: '🚨 対象エリア直撃・即時退避',
        badgeVariant: 'danger',
        title: `現在地は【${primary.name}】の直撃を受けています！`,
        description: `${primary.categoryText}。急速な冠水または斜面崩壊の危険が切迫しています。屋外の移動は命に関わります。`,
        action: isFlood
          ? '直ちに堅牢な建物の2階以上へ緊急垂直退避してください！'
          : '崖や斜面から直ちに離隔し、山と反対側の2階以上へ退避してください！'
      }
    };
  } else if (minDistanceMeters <= nearbyThresholdMeters) {
    // 近接警戒
    const nearest = nearestFeatureInfo;
    const isLandslide = nearest?.hazardType === 'landslide';
    return {
      status: 'NEARBY',
      distanceToNearestMeters: Math.round(minDistanceMeters),
      hitFeatures: [],
      nearestFeature: nearest,
      hudMessage: {
        badge: `⚠️ 近接警戒（危険エリアまで 約${Math.round(minDistanceMeters)}m）`,
        badgeVariant: 'warning',
        title: `現在地は平地ですが、至近（約${Math.round(minDistanceMeters)}m）に避難指示対象エリアが存在します！`,
        description: `対象: ${nearest?.name} (${nearest?.categoryText})。境界低地への土砂流出や、下流への急激な浸水波及に最大限警戒してください。`,
        action: isLandslide
          ? '崖・斜面方向へ近づかないこと。周囲の変状に注意してください。'
          : '低地・窪地への移動を避け、浸水の拡大に備えてください。'
      }
    };
  } else {
    // 区域外・安全
    return {
      status: 'OUTSIDE',
      distanceToNearestMeters: Math.round(minDistanceMeters),
      hitFeatures: [],
      nearestFeature: nearestFeatureInfo,
      hudMessage: {
        badge: 'ℹ️ 避難指示区域外（危険エリアまで ' + (minDistanceMeters === Infinity ? '十分' : Math.round(minDistanceMeters) + 'm') + '）',
        badgeVariant: 'safe',
        title: '現在地は指定避難指示エリアの範囲外です',
        description: '現在地における直接の避難指示区域重複は確認されませんでした。ただし、豪雨時における周囲の状況変化に注意してください。',
        action: '避難経路の確認および最新気象情報のチェック'
      }
    };
  }
}

/**
 * 国土交通省 重ねるハザードマップ（ディサポータル）タイルレイヤー定義
 */
export const MLIT_HAZARD_TILE_LAYERS = {
  // 洪水浸水想定区域（想定最大規模・浸水深）
  flood: {
    name: '国交省 洪水浸水想定区域（浸水深）',
    url: 'https://disaportaldata.gsi.go.jp/raster/01_flood_l2_shinsuishin_data/{z}/{x}/{y}.png',
    options: {
      maxNativeZoom: 17,
      maxZoom: 19,
      minZoom: 2,
      opacity: 0.85,
      attribution: '国交省 重ねるハザードマップ（洪水浸水想定区域）',
      pane: 'hazardTilePane'
    }
  },
  // 土砂災害警戒区域（急傾斜地の崩壊）
  steepSlope: {
    name: '国交省 土砂災害警戒区域（急傾斜地）',
    url: 'https://disaportaldata.gsi.go.jp/raster/05_kyukeishakeikaikuiki/{z}/{x}/{y}.png',
    options: {
      maxNativeZoom: 17,
      maxZoom: 19,
      minZoom: 2,
      opacity: 0.7,
      attribution: '国交省 重ねるハザードマップ（急傾斜地）',
      pane: 'hazardTilePane'
    }
  },
  // 土砂災害警戒区域（土石流）
  debrisFlow: {
    name: '国交省 土砂災害警戒区域（土石流）',
    url: 'https://disaportaldata.gsi.go.jp/raster/05_dosekiryukeikaikuiki/{z}/{x}/{y}.png',
    options: {
      maxNativeZoom: 17,
      maxZoom: 19,
      minZoom: 2,
      opacity: 0.7,
      attribution: '国交省 重ねるハザードマップ（土石流）',
      pane: 'hazardTilePane'
    }
  }
};

/**
 * 国交省 洪水浸水想定区域（浸水深）公式カラー凡例定義
 */
export const FLOOD_DEPTH_LEGEND = [
  { range: '0.5m未満', depth: '床下浸水', color: '#f7f5a9', border: '#d4cf60', alert: false },
  { range: '0.5〜3.0m', depth: '床上〜1階水没', color: '#ffb7b7', border: '#e07676', alert: true },
  { range: '3.0〜5.0m', depth: '2階床上浸水', color: '#ff7f7f', border: '#cc4b4b', alert: true },
  { range: '5.0m以上', depth: '2階水没〜屋根上', color: '#b27fff', border: '#8b4cd9', alert: true }
];

/**
 * ベースマップタイル定義
 */
export const BASE_MAP_LAYERS = {
  esriDark: {
    name: 'ESRI Dark Gray（防災HUDダーク）',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    options: {
      maxZoom: 16,
      attribution: '&copy; Esri, HERE, Garmin, &copy; OpenStreetMap'
    }
  },
  osm: {
    name: 'OpenStreetMap（標準カラー）',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }
  },
  gsiStandard: {
    name: '国土地理院 標準地図',
    url: 'https://cyberjapandata.gsi.go.jp/xyz/std/{z}/{x}/{y}.png',
    options: {
      maxZoom: 18,
      attribution: '&copy; 国土地理院（標準地図）'
    }
  },
  gsiPale: {
    name: '国土地理院 淡色地図',
    url: 'https://cyberjapandata.gsi.go.jp/xyz/pale/{z}/{x}/{y}.png',
    options: {
      maxZoom: 18,
      attribution: '&copy; 国土地理院（淡色地図）'
    }
  },
  gsiPhoto: {
    name: '国土地理院 航空オルソ写真',
    url: 'https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg',
    options: {
      maxZoom: 18,
      attribution: '&copy; 国土地理院（写真）'
    }
  }
};
