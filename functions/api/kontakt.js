function clean(value){return String(value||'').trim()}
function escapeHtml(value){return clean(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')}
function isValidEmail(value){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(value))}

export async function onRequestPost({request,env}){
  try{
    const formData=await request.formData();
    if(clean(formData.get('website'))){return Response.redirect(new URL('/danke.html',request.url),303)}

    const name=clean(formData.get('name'));
    const unternehmen=clean(formData.get('unternehmen'));
    const email=clean(formData.get('email'));
    const telefon=clean(formData.get('telefon'));
    const nachricht=clean(formData.get('nachricht'));
    const datenschutz=clean(formData.get('datenschutz'));

    if(!name||!email||!nachricht||datenschutz!=='akzeptiert'){
      return new Response('Bitte füllen Sie alle Pflichtfelder aus.',{status:400});
    }
    if(!isValidEmail(email)){
      return new Response('Bitte geben Sie eine gültige E-Mail-Adresse ein.',{status:400});
    }
    if(name.length>120||unternehmen.length>160||email.length>160||telefon.length>80||nachricht.length>4000){
      return new Response('Die Anfrage ist zu lang. Bitte kürzen Sie Ihre Eingaben.',{status:400});
    }
    if(!env.RESEND_API_KEY){
      return new Response('Der E-Mail-Versand ist noch nicht konfiguriert.',{status:503});
    }

    const to=env.CONTACT_TO||'kontakt@21kevage.com';
    const from=env.CONTACT_FROM||'21 Kevage <kontakt@mail.21kevage.com>';
    const subject=`Neue Website-Anfrage von ${name}`;
    const text=`Neue Anfrage über 21kevage.com\n\nName: ${name}\nUnternehmen: ${unternehmen}\nE-Mail: ${email}\nTelefon: ${telefon}\n\nNachricht:\n${nachricht}`;
    const html=`<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111"><h2>Neue Anfrage über 21kevage.com</h2><p><strong>Name:</strong> ${escapeHtml(name)}</p><p><strong>Unternehmen:</strong> ${escapeHtml(unternehmen)}</p><p><strong>E-Mail:</strong> ${escapeHtml(email)}</p><p><strong>Telefon:</strong> ${escapeHtml(telefon)}</p><hr><p><strong>Nachricht:</strong></p><p>${escapeHtml(nachricht).replaceAll('\n','<br>')}</p></div>`;

    const resendResponse=await fetch('https://api.resend.com/emails',{
      method:'POST',
      headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify({from,to,reply_to:email,subject,text,html})
    });

    if(!resendResponse.ok){
      console.error('Resend error:',await resendResponse.text());
      return new Response('Die Anfrage konnte leider nicht gesendet werden.',{status:502});
    }
    return Response.redirect(new URL('/danke.html',request.url),303);
  }catch(error){
    console.error(error);
    return new Response('Die Anfrage konnte leider nicht gesendet werden.',{status:500});
  }
}

export async function onRequestGet({request}){return Response.redirect(new URL('/#kontakt',request.url),303)}
