document.addEventListener('DOMContentLoaded', () => {
  const nameOutput = document.getElementById('guest-name-output');
  if (!nameOutput) return;

  const params = new URLSearchParams(window.location.search);
  let firstName = (params.get('name') || '').trim();

  if (!firstName) {
    try {
      firstName = (sessionStorage.getItem('reservationFirstName') || '').trim();
    } catch (error) {
      firstName = '';
    }
  }

  if (firstName) {
    nameOutput.textContent = `, ${firstName}`;
  }
});
