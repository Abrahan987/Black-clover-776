import fetch from 'node-fetch'
import yts from 'yt-search'

const name = 'Descargas - black clover'
const API_URL = 'https://api.delirius.online/download'
const PENDING_TTL = 2 * 60 * 1000 // la selección 1/2 expira a los 2 minutos

const pendientes = new Map()

const isYoutubeUrl = text =>
  /^https?:\/\/(www\.|m\.|music\.)?(youtube\.com|youtu\.be)\//i.test(text)

const cleanFileName = title => {
  return String(title || 'Descarga de YouTube')
    .replace(/[\\/:*?"<>|]/g, '')
    .trim()
    .slice(0, 100) || 'Descarga de YouTube'
}

// Busca por nombre en YouTube y devuelve el primer video válido
const buscarVideo = async query => {
  const result = await yts(query)
  const video = result?.videos?.find(v => v.seconds > 0)

  if (!video) {
    throw new Error('No encontré resultados para esa búsqueda')
  }

  return {
    url: video.url,
    title: video.title,
    author: video.author?.name || 'Desconocido',
    duration: video.timestamp || '',
    views: video.views ? video.views.toLocaleString('es-CO') : '',
    thumbnail: video.thumbnail
  }
}

// Si es un link lo usa directo; si es texto, lo busca
const resolverVideo = async query => {
  if (isYoutubeUrl(query)) return { url: query }
  return buscarVideo(query)
}

const getApiData = async (url, type) => {
  const endpoint = type === 'video' ? 'ytmp4' : 'ytmp3'

  const response = await fetch(
    `${API_URL}/${endpoint}?url=${encodeURIComponent(url)}`,
    {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0'
      }
    }
  )

  if (!response.ok) {
    throw new Error(`La API respondió con ${response.status}`)
  }

  let data

  try {
    data = await response.json()
  } catch {
    throw new Error('La API no devolvió una respuesta JSON válida')
  }

  if (!data?.status) {
    throw new Error(
      data?.message ||
      data?.error ||
      'La API rechazó la solicitud'
    )
  }

  const result = data?.data || data
  const dl = result?.download

  // En ytmp3 "download" es un string; por si en ytmp4 viene como objeto
  const downloadUrl =
    (typeof dl === 'string' ? dl : dl?.url) ||
    result?.dl ||
    result?.url

  if (!downloadUrl) {
    throw new Error('La API no devolvió el enlace de descarga')
  }

  return {
    url: downloadUrl,
    title: result?.title || '',
    quality:
      (typeof dl === 'object' && dl?.quality) ||
      result?.quality ||
      'Auto',
    duration: result?.duration || ''
  }
}

const downloadFile = async url => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0'
    }
  })

  if (!response.ok) {
    throw new Error(`No se pudo descargar el archivo: ${response.status}`)
  }

  return Buffer.from(await response.arrayBuffer())
}

const descargar = async (m, conn, url, type, fallbackTitle = '') => {
  const isVideo = type === 'video'

  try {
    await m.react('🕦')

    const data = await getApiData(url, type)
    const rawTitle = data.title || fallbackTitle || 'Descarga de YouTube'
    const title = cleanFileName(rawTitle)
    const buffer = await downloadFile(data.url)

    if (!buffer?.length) {
      throw new Error('El archivo descargado está vacío')
    }

    if (isVideo) {
      await conn.sendMessage(
        m.chat,
        {
          video: buffer,
          mimetype: 'video/mp4',
          fileName: `${title}.mp4`,
          caption: `☘️ *BLACK CLOVER BOT*

🎬 *Título:* ${rawTitle}
📺 *Calidad:* ${data.quality}${data.duration ? `\n⏱️ *Duración:* ${data.duration}` : ''}`
        },
        { quoted: m }
      )
    } else {
      await conn.sendMessage(
        m.chat,
        {
          audio: buffer,
          mimetype: 'audio/mpeg',
          fileName: `${title}.mp3`,
          ptt: false
        },
        { quoted: m }
      )
    }

    await m.react('☑️')
  } catch (error) {
    await m.react('❌')

    await conn.reply(
      m.chat,
      `🚩 *Error:* ${error?.message || 'No se pudo realizar la descarga'}`,
      m
    )
  }
}

const handler = async (m, { conn, args, command, usedPrefix }) => {
  const prefix = usedPrefix || '.'
  const query = args.join(' ').trim()

  if (!query) {
    return conn.reply(
      m.chat,
      `🚩 Ingresa el nombre de una canción o un link de YouTube\n\nEjemplos:\n${prefix}${command} yan block 444\n${prefix}${command} https://youtu.be/5M_n2UCe7DQ`,
      m
    )
  }

  if (command === 'play') {
    try {
      await m.react('🔎')

      const video = await resolverVideo(query)

      pendientes.set(m.sender, {
        url: video.url,
        title: video.title || '',
        time: Date.now()
      })

      // Si mandó un link directo no tenemos datos del video todavía
      const info = video.title
        ? `
🎵 *Título:* ${video.title}
👤 *Canal:* ${video.author}${video.duration ? `\n⏱️ *Duración:* ${video.duration}` : ''}${video.views ? `\n👁️ *Vistas:* ${video.views}` : ''}
`
        : ''

      const caption = `
࿆ㅤ໋︵ּㅤׄ⏜ּㅤ֯✿ִㅤ⃞ׄ𑁍⃞ㅤִ❀֯ㅤּ⏜ׄㅤּ︵  ࿆
𐚁 ֹ ִ *ʏᴏᴜᴛᴜʙᴇ ᴘʟᴀʏ* ! ୧ ֹ ִ
${info}
✐ *Selecciona una opción*

> 〄 *1.* Descargar en MP4 🎥
> 〄 *2.* Descargar en MP3 🎵

✐ *Escribe 1 o 2 para continuar y solo funciona una vez xd.*

📸 *Sígueme en Instagram*
> @cxrlios.7
https://www.instagram.com/cxrlitos.7
`.trim()

      if (video.thumbnail) {
        return await conn.sendMessage(
          m.chat,
          { image: { url: video.thumbnail }, caption },
          { quoted: m }
        )
      }

      return await conn.reply(m.chat, caption, m)
    } catch (error) {
      await m.react('❌')

      return conn.reply(
        m.chat,
        `🚩 *Error:* ${error?.message || 'No se pudo buscar la canción'}`,
        m
      )
    }
  }

  // ytmp3 / mp3 / ytmp4 / mp4: aceptan link o nombre
  const type = command === 'ytmp4' || command === 'mp4'
    ? 'video'
    : 'audio'

  try {
    await m.react('🔎')
    const video = await resolverVideo(query)
    await descargar(m, conn, video.url, type, video.title)
  } catch (error) {
    await m.react('❌')

    await conn.reply(
      m.chat,
      `🚩 *Error:* ${error?.message || 'No se pudo realizar la descarga'}`,
      m
    )
  }
}

handler.before = async (m, { conn }) => {
  if (!m.text) return
  if (m.text.startsWith('.')) return

  const seleccion = m.text.trim()

  if (seleccion !== '1' && seleccion !== '2') return

  const pending = pendientes.get(m.sender)

  if (!pending) return

  pendientes.delete(m.sender)

  if (Date.now() - pending.time > PENDING_TTL) return

  await descargar(
    m,
    conn,
    pending.url,
    seleccion === '1' ? 'video' : 'audio',
    pending.title
  )

  return true
}

handler.command = [
  'play',
  'ytmp4',
  'ytmp3',
  'mp4',
  'mp3'
]

handler.tags = ['descargas']

handler.help = [
  'play <nombre o link>',
  'ytmp4 <nombre o link>',
  'ytmp3 <nombre o link>'
]

export default handler
