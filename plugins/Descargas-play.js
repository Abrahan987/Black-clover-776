
import fetch from 'node-fetch'
import yts from 'yt-search'

const name = 'Descargas - black clover'
const API_AUDIO_URL = 'https://api.stellarwa.xyz/dl/ytmp3'
const API_AUDIO_KEY = 'proyectsV2'
const API_VIDEO_URL = 'https://api.delirius.online/download/ytmp4'
const PENDING_TTL = 2 * 60 * 1000

const pendientes = new Map()

const isYoutubeUrl = text =>
  /^https?:\/\/(www\.|m\.|music\.)?(youtube\.com|youtu\.be)\//i.test(text)

const cleanFileName = title => {
  return String(title || 'Descarga de YouTube')
    .replace(/[\\/:*?"<>|]/g, '')
    .trim()
    .slice(0, 100) || 'Descarga de YouTube'
}

const formatDuration = value => {
  if (typeof value !== 'number') return value || ''

  const minutes = Math.floor(value / 60)
  const seconds = String(value % 60).padStart(2, '0')

  return `${minutes}:${seconds}`
}

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

const resolverVideo = async query => {
  if (isYoutubeUrl(query)) return { url: query }
  return buscarVideo(query)
}

const requestJson = async requestUrl => {
  const response = await fetch(requestUrl, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'Mozilla/5.0'
    }
  })

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

  return data?.data || data
}

const getAudioData = async url => {
  const params = new URLSearchParams({
    url,
    key: API_AUDIO_KEY
  })

  const result = await requestJson(`${API_AUDIO_URL}?${params.toString()}`)
  const downloadUrl = result?.dl || result?.download || result?.url

  if (!downloadUrl) {
    throw new Error('La API no devolvió el enlace de descarga')
  }

  return {
    url: downloadUrl,
    title: result?.title || '',
    quality: 'Auto',
    duration: formatDuration(result?.duration)
  }
}

const getVideoData = async url => {
  const result = await requestJson(
    `${API_VIDEO_URL}?url=${encodeURIComponent(url)}`
  )

  const dl = result?.download

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
    duration: formatDuration(result?.duration)
  }
}

const getApiData = (url, type) =>
  type === 'video' ? getVideoData(url) : getAudioData(url)

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
