DELETE FROM leads
WHERE funil = 'callx'
  AND status_funil = 'mensagem_enviada'
  AND data_entrada > now() - interval '35 minutes'
  AND telefone IN (
    SELECT telefone FROM leads WHERE funil = 'reaquecimento'
  );