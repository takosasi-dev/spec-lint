// 設定の型・既定値(DEFAULTS)・data.json の読み込みの補い(§9.3)。既定値はここにだけ書く。
// obsidian を import しない(テストで読む)。パスの正規化は呼び手が normalizePath を渡す。設定タブは settings-tab.ts。
export interface Settings {
	schemaVersion: 1;
	rulesNotePath: string;
	autoCheck: boolean;
}

export const DEFAULTS: Settings = {
	schemaVersion: 1,
	rulesNotePath: "",                                                // 依頼者の決定(2026-10-10): 空 = 未設定(§8.4 の既定の案とは違う。元の値は NOTES.md)
	autoCheck: true,                                                  // 仮決め(D-10。§8.6 は未計測)
};

/** 規則ノートのパスを整える。空・空白だけ・"/"(normalizePath("") の戻り)は未設定("")にする */
export function cleanRulesPath(value: string, norm: (p: string) => string): string {
	const p = norm(value.trim());
	return p === "/" ? "" : p;
}

/**
 * data.json の中身を Settings にする。欠けた項目は既定値で埋める。
 * 形が壊れている・schemaVersion が違うときは既定値と problem=true を返す(呼び手はパネルに出し、data.json は上書きしない)。
 */
export function normalizeSettings(raw: unknown, norm: (p: string) => string): { settings: Settings; problem: boolean } {
	const base: Settings = { ...DEFAULTS };
	if (raw === null || raw === undefined) return { settings: base, problem: false };
	if (typeof raw !== "object" || Array.isArray(raw)) return { settings: base, problem: true };
	const r = raw as Record<string, unknown>;
	if (r.schemaVersion !== undefined && r.schemaVersion !== 1) return { settings: base, problem: true };
	return {
		settings: {
			schemaVersion: 1,
			rulesNotePath: typeof r.rulesNotePath === "string" ? cleanRulesPath(r.rulesNotePath, norm) : base.rulesNotePath,
			autoCheck: typeof r.autoCheck === "boolean" ? r.autoCheck : base.autoCheck,
		},
		problem: false,
	};
}
