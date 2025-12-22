import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getContactFormEmailTemplate } from '@/lib/email-templates'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, email, company, phone, message } = body

    // Validate required fields
    if (!name || !email || !message) {
      return NextResponse.json(
        { message: 'Name, email, and message are required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { message: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Get Payload instance
    const payload = await getPayload({ config })

    // Create email content
    const emailContent = getContactFormEmailTemplate({
      name,
      email,
      company: company || 'Not provided',
      phone: phone || 'Not provided',
      message,
    })

    // Send email to hello@containa.io
    await payload.sendEmail({
      to: 'hello@containa.io',
      from: process.env.EMAIL_FROM || 'no-reply@containa.io',
      subject: `New Contact Form Submission from ${name}`,
      html: emailContent,
    })

    return NextResponse.json(
      { message: 'Message sent successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error sending contact form email:', error)
    return NextResponse.json(
      { message: 'Failed to send message. Please try again later.' },
      { status: 500 }
    )
  }
}

