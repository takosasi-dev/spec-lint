// 設定タブ(minAppVersion 1.14.4 なので getSettingDefinitions の宣言型。D-16): 規則ノートのパスと自動検査の ON/OFF。
// 保存は Plugin.saveData() だけ(INV-1)。パスは normalizePath を通す(§9.3)。保存したら少し待って検査し直す。
import { normalizePath, PluginSettingTab, type App, type SettingDefinitionItem } from "obsidian";
import type SpecLintPlugin from "./main";
import { cleanRulesPath } from "./settings";

export class SpecLintSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly owner: SpecLintPlugin) {
		super(app, owner);
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{ name: "規則ノートのパス", desc: "vault からのパス。中の json のブロック1つが検査の規則のすべて。未設定(空)のあいだは検査を1つもしない(例: Docs/SpecLint rules.md)", control: { type: "text", key: "rulesNotePath" } },
			{ name: "自動検査", desc: "仕様書を開いたときと、仕様書か規則ノートが変わったときに検査する。切ると、ボタンかコマンドでだけ検査する", control: { type: "toggle", key: "autoCheck" } },
		];
	}

	getControlValue(key: string): unknown {
		const s = this.owner.settings;
		return key === "rulesNotePath" ? s.rulesNotePath : key === "autoCheck" ? s.autoCheck : undefined;
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		const s = this.owner.settings;
		if (key === "rulesNotePath") s.rulesNotePath = cleanRulesPath(String(value), normalizePath);
		else if (key === "autoCheck") s.autoCheck = value === true;
		else return;
		await this.owner.saveSettings();
	}
}
