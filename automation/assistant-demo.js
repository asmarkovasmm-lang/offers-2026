(function () {
  'use strict';
  var examples = {
    ads: {
      question: 'Что с рекламой?', title: 'Реклама за выбранный период',
      values: [['Расходы', '48 000 ₽'], ['Обращения', '120'], ['За обращение', '400 ₽']],
      note: 'В одном ответе — расход бюджета и стоимость обращения. Можно обсудить эти показатели со специалистом.'
    },
    sales: {
      question: 'Какие продажи?', title: 'Продажи за выбранный период',
      values: [['Заказы', '128'], ['Выручка', '89 600 ₽'], ['Средний чек', '700 ₽']],
      note: 'В одном ответе — заказы, выручка и средний чек. Вы видите объем продаж за выбранный период.'
    }
  };
  var labels = {ads: 'Аналитика рекламы', sales: 'Аналитика продаж', questions: 'Вопрос помощнику'};
  document.querySelectorAll('[data-assistant-demo]').forEach(function (root) {
    var buttons = Array.from(root.querySelectorAll('[data-assistant-section]'));
    var prompts = Array.from(root.querySelectorAll('[data-assistant-question]'));
    var chat = root.querySelector('[data-assistant-chat]');
    var input = root.querySelector('.assistant-demo-input');
    var status = root.querySelector('[data-assistant-status]');
    if (!chat || !input || !status || buttons.length !== 3) return;

    function element(tag, className, text) {
      var el = document.createElement(tag);
      el.className = className;
      if (text) el.textContent = text;
      return el;
    }
    function render(section, answer) {
      if (!labels[section]) return;
      buttons.forEach(function (button) {
        button.setAttribute('aria-pressed', String(button.dataset.assistantSection === section));
      });
      var data = examples[answer];
      chat.replaceChildren();
      var bubble = element('div', 'assistant-demo-user');
      bubble.appendChild(element('span', '', data ? data.question : 'Вопрос помощнику'));
      chat.appendChild(bubble);
      var reply = element('div', 'assistant-demo-answer assistant-demo-response-in');
      reply.appendChild(element('p', 'assistant-demo-answer-title', data ? data.title : 'Выбери пример вопроса'));
      reply.appendChild(element('p', 'assistant-demo-period', 'Демонстрационные данные'));
      if (data) {
        var metrics = element('div', 'assistant-demo-metrics');
        data.values.forEach(function (value) {
          var metric = element('div', 'assistant-demo-metric');
          metric.appendChild(element('span', '', value[0]));
          metric.appendChild(element('strong', '', value[1]));
          metrics.appendChild(metric);
        });
        reply.appendChild(metrics);
        reply.appendChild(element('p', 'assistant-demo-answer-note', data.note));
      } else {
        reply.appendChild(element('p', 'assistant-demo-answer-note', 'Нажми «Что с рекламой?» или «Какие продажи?» ниже и посмотри пример ответа.'));
      }
      chat.appendChild(reply);
      input.value = data ? data.question : '';
      status.textContent = labels[section] + '. ' + (data ? data.title + ': ' + data.values.map(function (v) { return v[0] + ' — ' + v[1]; }).join(', ') : 'Доступны два готовых примера вопроса.');
    }
    buttons.forEach(function (button) {
      button.disabled = false;
      button.addEventListener('click', function () {
        var section = button.dataset.assistantSection;
        render(section, section === 'questions' ? null : section);
      });
    });
    prompts.forEach(function (button) {
      button.disabled = false;
      button.addEventListener('click', function () {
        render('questions', button.dataset.assistantQuestion);
      });
    });
  });
})();
