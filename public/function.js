function updateGauge(id, value) {
  const circle = document.querySelector(`#${id} .circle`);
  const percentage = Math.max(0, Math.min(value, 100)); // 0〜100に制限
  const offset = 100 - percentage; // ダッシュオフセットの計算
  circle.style.strokeDashoffset = offset; // ゲージを更新

  // 数値の表示を更新
  const text = document.querySelector(`#${id} span`);
  text.textContent = value;
}

// 初期値をセット
updateGauge("hunger-value", 50); // 満腹度
updateGauge("cleanliness-value", 70); // 清潔度
updateGauge("comfort-value", 85); // 快適度
updateGauge("happiness-value", 90); // 幸福度

// アクションボタンに連動
function action(type) {
  if (type === "feed") {
    updateGauge("hunger-value", 80); // 例: 満腹度を80に
  } else if (type === "bath") {
    updateGauge("cleanliness-value", 90); // 清潔度を90に
  }
  // 他のアクションも同様に追加
}
