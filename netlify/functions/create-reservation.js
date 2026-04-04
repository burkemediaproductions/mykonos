const { createClient } = require('@supabase/supabase-js');
const twilio = require('twilio');
const sgMail = require('@sendgrid/mail');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' });
  }

  try {
    const body = JSON.parse(event.body || '{}');

    const cleaned = normalize(body);
    const validationError = validate(cleaned);
    if (validationError) {
      return json(400, { error: validationError });
    }

    const isoDateTime = `${cleaned.reservation_date}T${cleaned.reservation_time}:00`;

    const { data: existing, error: existingError } = await supabase
      .from('reservations')
      .select('id')
      .eq('reservation_date', cleaned.reservation_date)
      .eq('reservation_time', cleaned.reservation_time)
      .eq('status', 'confirmed');

    if (existingError) {
      console.error(existingError);
      return json(500, { error: 'Failed checking availability.' });
    }

    if (existing.length >= 12) {
      return json(409, { error: 'That time is fully booked. Please choose another time.' });
    }

    const insertPayload = {
      first_name: cleaned.first_name,
      last_name: cleaned.last_name,
      email: cleaned.email,
      phone: cleaned.phone,
      reservation_date: cleaned.reservation_date,
      reservation_time: cleaned.reservation_time,
      reservation_at: isoDateTime,
      party_size: cleaned.party_size,
      occasion: cleaned.occasion,
      notes: cleaned.notes,
      sms_opt_in: cleaned.sms_opt_in,
      status: 'confirmed',
      source: 'website',
    };

    const { data: insertedRows, error: insertError } = await supabase
      .from('reservations')
      .insert(insertPayload)
      .select();

    if (insertError) {
      console.error(insertError);
      return json(500, { error: 'Could not save reservation.' });
    }

    const reservation = insertedRows[0];

    const guestName = `${reservation.first_name} ${reservation.last_name}`.trim();
    const niceDate = reservation.reservation_date;
    const niceTime = formatTime(reservation.reservation_time);

    const staffSms =
      `New Mykonos reservation: ${guestName}, party of ${reservation.party_size}, ${niceDate} at ${niceTime}. Phone: ${reservation.phone}`;

    const guestSms =
      `Mykonos reservation confirmed for ${guestName}: ${niceDate} at ${niceTime} for ${reservation.party_size}. Questions? Call (442) 282-5105.`;

    const staffEmailHtml = `
      <h2>New Reservation</h2>
      <p><strong>Name:</strong> ${escapeHtml(guestName)}</p>
      <p><strong>Email:</strong> ${escapeHtml(reservation.email)}</p>
      <p><strong>Phone:</strong> ${escapeHtml(reservation.phone)}</p>
      <p><strong>Date:</strong> ${escapeHtml(niceDate)}</p>
      <p><strong>Time:</strong> ${escapeHtml(niceTime)}</p>
      <p><strong>Party Size:</strong> ${reservation.party_size}</p>
      <p><strong>Occasion:</strong> ${escapeHtml(reservation.occasion || '')}</p>
      <p><strong>Notes:</strong> ${escapeHtml(reservation.notes || '')}</p>
    `;

    const guestEmailHtml = `
      <h2>Your Mykonos Reservation is Confirmed</h2>
      <p>Hi ${escapeHtml(reservation.first_name)},</p>
      <p>We have you down for <strong>${escapeHtml(niceDate)}</strong> at <strong>${escapeHtml(niceTime)}</strong> for <strong>${reservation.party_size}</strong>.</p>
      <p>If you need to update your reservation, call us at <strong>(442) 282-5105</strong>.</p>
      <p>We look forward to serving you.</p>
    `;

    await Promise.all([
      twilioClient.messages.create({
        from: process.env.TWILIO_FROM_NUMBER,
        to: process.env.RESTAURANT_ALERT_PHONE,
        body: staffSms,
      }),
      reservation.sms_opt_in
        ? twilioClient.messages.create({
            from: process.env.TWILIO_FROM_NUMBER,
            to: reservation.phone,
            body: guestSms,
          })
        : Promise.resolve(),
      sgMail.send({
        to: process.env.RESTAURANT_ALERT_EMAIL,
        from: process.env.SENDGRID_FROM_EMAIL,
        subject: `New reservation: ${guestName} - ${niceDate} ${niceTime}`,
        text: stripHtml(staffEmailHtml),
        html: staffEmailHtml,
      }),
      sgMail.send({
        to: reservation.email,
        from: process.env.SENDGRID_FROM_EMAIL,
        subject: 'Your Mykonos reservation is confirmed',
        text: stripHtml(guestEmailHtml),
        html: guestEmailHtml,
      }),
    ]);

    return json(200, {
      ok: true,
      reservation_id: reservation.id,
    });
  } catch (error) {
    console.error(error);
    return json(500, { error: 'Unexpected server error.' });
  }
};

function normalize(body) {
  return {
    first_name: String(body.first_name || '').trim(),
    last_name: String(body.last_name || '').trim(),
    email: String(body.email || '').trim().toLowerCase(),
    phone: String(body.phone || '').trim(),
    reservation_date: String(body.reservation_date || '').trim(),
    reservation_time: String(body.reservation_time || '').trim(),
    party_size: Number(body.party_size || 0),
    occasion: String(body.occasion || '').trim(),
    notes: String(body.notes || '').trim(),
    sms_opt_in: Boolean(body.sms_opt_in),
  };
}

function validate(data) {
  if (!data.first_name) return 'First name is required.';
  if (!data.last_name) return 'Last name is required.';
  if (!data.email) return 'Email is required.';
  if (!data.phone) return 'Phone is required.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.reservation_date)) return 'Valid reservation date is required.';
  if (!/^\d{2}:\d{2}$/.test(data.reservation_time)) return 'Valid reservation time is required.';
  if (!Number.isInteger(data.party_size) || data.party_size < 1 || data.party_size > 20) {
    return 'Party size must be between 1 and 20.';
  }
  return '';
}

function formatTime(value) {
  const [h, m] = value.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12}:${String(m).padStart(2, '0')} ${suffix}`;
}

function json(statusCode, payload) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  };
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripHtml(html) {
  return String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}