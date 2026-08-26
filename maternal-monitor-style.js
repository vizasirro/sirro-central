(() => {
  if (window.SIRRO_MATERNAL_MONITOR_STYLE) return;
  window.SIRRO_MATERNAL_MONITOR_STYLE = true;
  const style=document.createElement('style');
  style.textContent=`
    #tabs #maternalMonitorTabBtn{
      background:#8a3d78!important;
      color:#fff!important;
      border:1px solid #743164!important;
      box-shadow:0 1px 3px #0002!important;
    }
    #tabs #maternalMonitorTabBtn:hover,
    #tabs #maternalMonitorTabBtn:focus{
      background:#753366!important;
      color:#fff!important;
    }
    #tabs #maternalMonitorTabBtn.active{
      background:#6a2b5d!important;
      color:#fff!important;
      outline:2px solid #d9b8cf!important;
      outline-offset:2px!important;
    }
  `;
  document.head.appendChild(style);
})();
