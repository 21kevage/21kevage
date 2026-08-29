const RESPONSE_HEADERS={
  'Cache-Control':'no-store',
  'Content-Type':'text/plain; charset=utf-8',
  'X-Content-Type-Options':'nosniff'
}

function clean(value){return String(value||'').trim()}
function cleanInline(value){return clean(value).replace(/[\r\n\t]+/g,' ').replace(/\s{2,}/g,' ')}
function escapeHtml(value){return clean(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')}
function isValidEmail(value){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(value))}
function textResponse(message,status){return new Response(message,{status,headers:RESPONSE_HEADERS})}
function redirect(request,path){return Response.redirect(new URL(path,request.url),303)}

function isSameOriginRequest(request){
  const requestUrl=new URL(request.url)
  const origin=request.headers.get('Origin')
  const fetchSite=request.headers.get('Sec-Fetch-Site')
  if(origin&&origin!==requestUrl.origin)return false
  if(fetchSite&&!['same-origin','none'].includes(fetchSite))return false
  return true
}

export async function onRequestPost({request,env}){
  try{
    if(!isSameOriginRequest(request))return textResponse('Die Anfrage wurde aus Sicherheitsgründen abgelehnt.',403)

    const contentType=request.headers.get('Content-Type')||''
    if(!contentType.includes('application/x-www-form-urlencoded')&&!contentType.includes('multipart/form-data')){
      return textResponse('Das Formularformat wird nicht unterstützt.',415)
    }

    const contentLength=Number(request.headers.get('Content-Length')||0)
    if(contentLength>20000)return textResponse('Die Anfrage ist zu groß.',413)

    const formData=await request.formData()
    if(clean(formData.get('website')))return redirect(request,'/danke.html')

    const startedAt=Number(formData.get('form_started_at'))
    const formAge=Date.now()-startedAt
    if(!Number.isFinite(startedAt)||formAge<2500||formAge>43200000){
      return textResponse('Das Formular ist abgelaufen. Bitte laden Sie die Seite neu und versuchen Sie es erneut.',400)
    }

    const name=cleanInline(formData.get('name'))
    const unternehmen=cleanInline(formData.get('unternehmen'))
    const email=cleanInline(formData.get('email'))
    const telefon=cleanInline(formData.get('telefon'))
    const nachricht=clean(formData.get('nachricht'))
    const datenschutz=clean(formData.get('datenschutz'))

    if(!name||!email||!nachricht||datenschutz!=='bestaetigt'){
      return textResponse('Bitte füllen Sie alle Pflichtfelder aus.',400)
    }
    if(name.length<2||nachricht.length<10){
      return textResponse('Bitte beschreiben Sie Ihre Anfrage etwas genauer.',400)
    }
    if(!isValidEmail(email))return textResponse('Bitte geben Sie eine gültige E-Mail-Adresse ein.',400)
    if(name.length>120||unternehmen.length>160||email.length>160||telefon.length>80||nachricht.length>4000){
      return textResponse('Die Anfrage ist zu lang. Bitte kürzen Sie Ihre Eingaben.',400)
    }
    if(!env.RESEND_API_KEY)return textResponse('Der E-Mail-Versand ist noch nicht konfiguriert.',503)

    const to=env.CONTACT_TO||'kontakt@21kevage.com'
    const from=env.CONTACT_FROM||'zeigdich. <kontakt@mail.21kevage.com>'
    const subject=`Neue Website-Anfrage von ${name}`
    const text=`Neue Anfrage über 21kevage.com\n\nName: ${name}\nUnternehmen: ${unternehmen}\nE-Mail: ${email}\nTelefon: ${telefon}\n\nNachricht:\n${nachricht}`
    const html=`<div style="font-family:Arial,sans-serif;line-height:1.6;color:#111"><h2>Neue Anfrage über 21kevage.com</h2><p><strong>Name:</strong> ${escapeHtml(name)}</p><p><strong>Unternehmen:</strong> ${escapeHtml(unternehmen)}</p><p><strong>E-Mail:</strong> ${escapeHtml(email)}</p><p><strong>Telefon:</strong> ${escapeHtml(telefon)}</p><hr><p><strong>Nachricht:</strong></p><p>${escapeHtml(nachricht).replaceAll('\n','<br>')}</p></div>`

    const resendResponse=await fetch('https://api.resend.com/emails',{
      method:'POST',
      headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Accept':'application/json'},
      body:JSON.stringify({from,to,reply_to:email,subject,text,html})
    })

    if(!resendResponse.ok){
      console.error('Resend request failed with status',resendResponse.status)
      return textResponse('Die Anfrage konnte leider nicht gesendet werden.',502)
    }
    return redirect(request,'/danke.html')
  }catch(error){
    console.error('Contact form failed',error instanceof Error?error.message:'Unknown error')
    return textResponse('Die Anfrage konnte leider nicht gesendet werden.',500)
  }
}

export async function onRequestGet({request}){return redirect(request,'/#kontakt')}
