(() => {
  // Regla de Oro: cambio aditivo. El Administrador Regional conserva la
  // gestión de acceso de otros usuarios, pero no muestra Restablecer acceso
  // sobre su propia cuenta. Su recuperación personal se realiza desde login.
  const previousRender=typeof renderUsers==='function'?renderUsers:null;
  if(!previousRender)return;

  renderUsers=function(){
    previousRender();
    if(typeof profile==='undefined'||profile?.rol!=='ADMIN_REGIONAL')return;
    const ownId=profile?.id||profile?.usuario_id||profile?.user_id;
    if(!ownId)return;
    const ownReset=document.querySelector(`#usersList [data-reset-user="${ownId}"]`);
    if(ownReset)ownReset.remove();
  };

  renderUsers();
})();
