(function () {
  'use strict';
  // Synthetic examples only. No API requests or live account connection.
  var frames = [
    {creatives:[{spend:30000,leads:60,status:'Крутится'},{spend:18000,leads:60,status:'Крутится'}],paid:128,average:700},
    {creatives:[{spend:22000,leads:50,status:'Крутится'},{spend:19800,leads:60,status:'Пауза'}],paid:116,average:750},
    {creatives:[{spend:42000,leads:80,status:'Крутится'},{spend:21000,leads:60,status:'Крутится'}],paid:142,average:680},
    {creatives:[{spend:28800,leads:60,status:'Пауза'},{spend:14400,leads:60,status:'Крутится'}],paid:120,average:720}
  ];
  var labels = {ads:'Аналитика рекламы',sales:'Аналитика продаж',questions:'Вопрос помощнику'};
  var money = new Intl.NumberFormat('ru-RU',{maximumFractionDigits:0});
  var price = new Intl.NumberFormat('ru-RU',{minimumFractionDigits:0,maximumFractionDigits:2});
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var clone = function (value) { return JSON.parse(JSON.stringify(value)); };
  function localISO(date) { return date.getFullYear()+'-'+String(date.getMonth()+1).padStart(2,'0')+'-'+String(date.getDate()).padStart(2,'0'); }
  function shift(date,days) { var next=new Date(date);next.setDate(next.getDate()+days);return next; }
  function parseDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    var date=new Date(value+'T12:00:00');
    return Number.isNaN(date.getTime()) || localISO(date)!==value ? null : date;
  }
  function spanDays(from,to) { return Math.round((Date.UTC(to.getFullYear(),to.getMonth(),to.getDate())-Date.UTC(from.getFullYear(),from.getMonth(),from.getDate()))/86400000)+1; }
  function periodFor(key) {
    var today=new Date();today.setHours(12,0,0,0);
    var monday=shift(today,-((today.getDay()+6)%7));
    if(key==='today')return {key:key,label:'Сегодня',from:today,to:today};
    if(key==='yesterday')return {key:key,label:'Вчера',from:shift(today,-1),to:shift(today,-1)};
    if(key==='week')return {key:key,label:'Эта неделя',from:monday,to:today};
    if(key==='month')return {key:key,label:'С начала месяца',from:new Date(today.getFullYear(),today.getMonth(),1,12),to:today};
    return {key:'previous',label:'Прошлая неделя',from:shift(monday,-7),to:shift(monday,-1)};
  }
  function dataFor(frameIndex,days) {
    var frame=frames[frameIndex],factor=days/7;
    var creatives=frame.creatives.map(function (creative) {
      var leads=Math.max(1,Math.round(creative.leads*factor));
      return {leads:leads,spend:leads*(creative.spend/creative.leads),status:creative.status};
    });
    var paid=Math.max(1,Math.round(frame.paid*factor));
    return {creatives:creatives,paid:paid,average:frame.average};
  }
  function valuesFor(data) {
    var values={};
    data.creatives.forEach(function (creative,i) {
      values['creative-'+i+'-spend']=creative.spend;
      values['creative-'+i+'-leads']=creative.leads;
      values['creative-'+i+'-cpl']=creative.spend/creative.leads;
    });
    values['ads-spend']=data.creatives.reduce(function (sum,c) {return sum+c.spend;},0);
    values['ads-leads']=data.creatives.reduce(function (sum,c) {return sum+c.leads;},0);
    values['ads-cpl']=values['ads-spend']/values['ads-leads'];
    values['sales-paid']=data.paid;values['sales-average']=data.average;values['sales-revenue']=data.paid*data.average;
    return values;
  }
  function formatValue(key,value) {
    if(/leads$|paid$/.test(key))return money.format(value);
    return (/cpl$/.test(key)?price:money).format(value)+' ₽';
  }
  document.querySelectorAll('[data-assistant-demo]').forEach(function (root) {
    var tabs=Array.from(root.querySelectorAll('[data-assistant-section]'));
    var panels=Array.from(root.querySelectorAll('[data-assistant-panel]'));
    var periods=Array.from(root.querySelectorAll('[data-assistant-period]'));
    var pause=root.querySelector('[data-assistant-pause]');
    var dateForm=root.querySelector('[data-assistant-dates]');
    var fromInput=root.querySelector('[data-assistant-from]'),toInput=root.querySelector('[data-assistant-to]');
    var dateError=root.querySelector('[data-assistant-date-error]');
    var input=root.querySelector('.assistant-demo-input');
    var question=root.querySelector('[data-assistant-question-answer]');
    var status=root.querySelector('[data-assistant-status]');
    var counter=root.querySelector('[data-assistant-frame]');
    var creativeToggle=root.querySelector('[data-assistant-creatives]');
    var creativeList=root.querySelector('[data-assistant-creative-list]');
    if(tabs.length!==3||!pause||!dateForm||!input||!question||!status||!counter||!creativeToggle||!creativeList)return;
    var selected=periodFor('previous'),frameIndex=0,current=dataFor(0,7),target=clone(current);
    var visible=false,paused=false,clock=0,raf=0,questionKind=null;
    function announce(text) {status.textContent=text;}
    function paint(data) {
      current=data;var values=valuesFor(data);
      root.querySelectorAll('[data-assistant-value]').forEach(function (node) {
        var key=node.dataset.assistantValue;
        if(Object.prototype.hasOwnProperty.call(values,key))node.textContent=formatValue(key,values[key]);
      });
      root.querySelectorAll('[data-assistant-creative-status]').forEach(function (node) {
        var creative=data.creatives[Number(node.dataset.assistantCreativeStatus)];
        node.textContent=creative.status;node.classList.toggle('assistant-demo-creative-paused',creative.status==='Пауза');
      });
    }
    function stopAnimation(finish) {cancelAnimationFrame(raf);raf=0;if(finish)paint(clone(target));}
    function animate(next) {
      stopAnimation(false);target=clone(next);
      if(reduce.matches||paused||!visible||document.hidden){paint(clone(target));return;}
      var before=clone(current),start=null;
      function count(now) {
        if(start===null)start=now;
        var p=Math.min((now-start)/1100,1),eased=1-Math.pow(1-p,3);
        var blend=function (a,b) {return Math.round(a+(b-a)*eased);};
        var intermediate={paid:blend(before.paid,next.paid),average:blend(before.average,next.average),creatives:next.creatives.map(function (creative,i) {
          return {spend:blend(before.creatives[i].spend,creative.spend),leads:Math.max(1,blend(before.creatives[i].leads,creative.leads)),status:creative.status};
        })};
        paint(intermediate);
        if(p<1)raf=requestAnimationFrame(count);else{raf=0;paint(clone(target));}
      }
      raf=requestAnimationFrame(count);
    }
    function periodText() {
      return selected.label+' · '+selected.from.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'})+' — '+selected.to.toLocaleDateString('ru-RU',{day:'2-digit',month:'2-digit',year:'numeric'});
    }
    function paintPeriod() {
      root.querySelectorAll('[data-assistant-period-label]').forEach(function (node) {node.textContent=periodText();});
      periods.forEach(function (button) {button.setAttribute('aria-pressed',String(button.dataset.assistantPeriod===selected.key));});
    }
    function changePeriod(next) {
      selected=next;paintPeriod();animate(dataFor(frameIndex,spanDays(selected.from,selected.to)));
      announce('Демонстрационный отчет: '+selected.label+'.');
    }
    function selectTab(section) {
      if(!labels[section])return;
      tabs.forEach(function (button) {button.setAttribute('aria-pressed',String(button.dataset.assistantSection===section));});
      panels.forEach(function (panel) {panel.hidden=panel.dataset.assistantPanel!==section;});
      announce(labels[section]+'. Демонстрационные данные.');
    }
    function make(tag,className,text) {
      var el=document.createElement(tag);el.className=className;if(text)el.textContent=text;return el;
    }
    function answer(kind) {
      questionKind=kind;selectTab('questions');question.replaceChildren();
      var user=make('div','assistant-demo-user');user.appendChild(make('span','',kind==='ads'?'Что с рекламой?':'Какие продажи?'));question.appendChild(user);
      var reply=make('div','assistant-demo-answer');
      reply.appendChild(make('p','assistant-demo-answer-title',kind==='ads'?'Реклама за выбранный период':'Оплаченные заказы за выбранный период'));
      var period=make('p','assistant-demo-period',periodText());period.dataset.assistantPeriodLabel='';reply.appendChild(period);
      var metrics=make('div','assistant-demo-metrics');
      var items=kind==='ads'?[['Расходы','ads-spend'],['Обращения','ads-leads'],['За обращение','ads-cpl']]:[['Оплачено заказов','sales-paid'],['Выручка','sales-revenue'],['Средний чек','sales-average']];
      items.forEach(function (item) {var card=make('div','assistant-demo-metric');card.appendChild(make('span','',item[0]));var number=make('strong','');number.dataset.assistantValue=item[1];card.appendChild(number);metrics.appendChild(card);});
      reply.appendChild(metrics);reply.appendChild(make('p','assistant-demo-answer-note','Пример ответа по текущим вымышленным показателям.'));question.appendChild(reply);
      input.value=kind==='ads'?'Что с рекламой?':'Какие продажи?';paint(current);
      var values=valuesFor(current);announce(input.value+' '+items.map(function (item) {return item[0]+' — '+formatValue(item[1],values[item[1]]);}).join(', '));
    }
    function motion() {
      clearInterval(clock);clock=0;
      pause.hidden=reduce.matches;
      pause.textContent=paused?'Продолжить показ':'Пауза';pause.setAttribute('aria-pressed',String(paused));
      if(reduce.matches||paused||!visible||document.hidden){stopAnimation(true);return;}
      clock=setInterval(function () {
        frameIndex=(frameIndex+1)%frames.length;counter.textContent='Пример '+(frameIndex+1)+' из '+frames.length;
        animate(dataFor(frameIndex,spanDays(selected.from,selected.to)));
      },8000);
    }
    tabs.forEach(function (button) {button.disabled=false;button.addEventListener('click',function () {selectTab(button.dataset.assistantSection);});});
    periods.forEach(function (button) {
      button.disabled=false;button.addEventListener('click',function () {
        if(button.dataset.assistantPeriod==='custom'){dateForm.hidden=!dateForm.hidden;button.setAttribute('aria-expanded',String(!dateForm.hidden));if(!dateForm.hidden)fromInput.focus();return;}
        dateForm.hidden=true;root.querySelector('[data-assistant-period="custom"]').setAttribute('aria-expanded','false');dateError.textContent='';changePeriod(periodFor(button.dataset.assistantPeriod));
      });
    });
    var today=new Date();today.setHours(12,0,0,0);
    fromInput.value=localISO(selected.from);toInput.value=localISO(selected.to);fromInput.max=toInput.max=localISO(today);
    dateForm.querySelectorAll('input,button').forEach(function (node) {node.disabled=false;});
    dateForm.addEventListener('submit',function (event) {
      event.preventDefault();var from=parseDate(fromInput.value),to=parseDate(toInput.value);
      if(!from||!to||to<from||to>today||spanDays(from,to)>366){dateError.textContent='Выбери период до 366 дней: начало раньше конца, даты не позднее сегодняшней.';return;}
      dateError.textContent='';changePeriod({key:'custom',label:'Свои даты',from:from,to:to});
    });
    creativeToggle.disabled=false;creativeToggle.addEventListener('click',function () {creativeList.hidden=!creativeList.hidden;creativeToggle.setAttribute('aria-expanded',String(!creativeList.hidden));});
    root.querySelectorAll('[data-assistant-question]').forEach(function (button) {button.disabled=false;button.addEventListener('click',function () {answer(button.dataset.assistantQuestion);});});
    pause.addEventListener('click',function () {paused=!paused;motion();announce(paused?'Смена демонстрационных показателей приостановлена.':'Смена демонстрационных показателей продолжена.');});
    if('IntersectionObserver' in window)new IntersectionObserver(function (entries) {visible=entries[0].isIntersecting;motion();},{threshold:0}).observe(root);
    else {
      var visibility=function () {var box=root.getBoundingClientRect();var next=box.bottom>0&&box.top<window.innerHeight;if(next!==visible){visible=next;motion();}};
      window.addEventListener('scroll',visibility,{passive:true});window.addEventListener('resize',visibility);visibility();
    }
    document.addEventListener('visibilitychange',motion);
    if(reduce.addEventListener)reduce.addEventListener('change',motion);else if(reduce.addListener)reduce.addListener(motion);
    paintPeriod();paint(current);motion();
  });
})();
