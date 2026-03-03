DELETE FROM leads
WHERE funil = 'callx'
  AND status_funil = 'mensagem_enviada'
  AND telefone IN (
    SELECT telefone FROM leads WHERE funil = 'reaquecimento'
  );