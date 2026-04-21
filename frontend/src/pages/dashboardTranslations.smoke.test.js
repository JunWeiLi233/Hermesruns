import assert from 'node:assert/strict';
import translations from '../i18n/translations.js';

const dashboardZh = translations['zh-CN']?.dashboard;

assert.ok(dashboardZh, 'zh-CN dashboard translations should exist.');

const expectedDashboardStrings = {
  brand_mark: '管理后台',
  role_admin: '管理员',
  role_user: '普通用户',
  tier_free: '免费版',
  tier_pro: 'Pro 版',
  course_maps_title: '赛事赛道图',
  course_maps_intro: '这里管理每场赛事的全局赛道图。管理员可以扫描官方来源，或上传清晰的赛道图图片 / PDF 页面到待发布预览中，再与当前线上版本对比，确认可信后再发布给所有用户。',
  course_maps_workspace_copy: '待发布预览只用于审核。请先上传清晰、适合 AI 扫描的赛道图页面，再确认对齐预览可靠后，赛事详情页才会使用这份线上版本。',
  course_maps_upload: '上传图片 / PDF',
  course_maps_drop_hint: '可将图片或 PDF 页面拖到这里。粘贴仍只支持图片。',
  course_maps_actions_hint: '扫描会优先搜索官方来源，上传支持本地图片和 PDF，重新分析会复用已保存的上传文件。最佳效果来自单页、清晰的赛道图，而不是海报或拼图。',
  course_maps_scan_quality_hint: '请给 AI 一张清晰的单页赛道图，能看清路线、起终点、转向标注和比例尺。海报、赞助图或多面板拼图通常很难正确识别。',
  course_maps_file_type_error: '请上传赛道图图片或 PDF 文件。',
  course_maps_status_running_upload: '正在上传源文件...',
  review_pending_summary_fallback: '待发布预览应展示 Hermes 读取到的地图页面、对齐结果，以及足够判断 AI 扫描质量的路线细节，方便管理员发布前先审核。',
  catalog_lang_zh: '中文',
  catalog_lang_en: '英文',
};

for (const [key, expectedValue] of Object.entries(expectedDashboardStrings)) {
  assert.equal(
    dashboardZh[key],
    expectedValue,
    `dashboard zh-CN key "${key}" should stay readable and stable.`
  );
  assert.doesNotMatch(
    dashboardZh[key],
    /\?{2,}/,
    `dashboard zh-CN key "${key}" should never degrade into question marks.`
  );
}

console.log('[PASS] Dashboard translation smoke test passed.');
