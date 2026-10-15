<?php
// UNIT III: PHP REST API + database for shot-tracking records
header('Content-Type: application/json');
$db = new PDO('sqlite:' . __DIR__ . '/linecall.db');
$db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$db->exec("CREATE TABLE IF NOT EXISTS shots (
  id INTEGER PRIMARY KEY AUTOINCREMENT, player TEXT, set_no INTEGER, type TEXT, speed REAL,
  bx REAL, by REAL, half TEXT, box TEXT, call_ TEXT, decision TEXT, margin INTEGER,
  challenged INTEGER, overturned INTEGER)");

function fmt($r) {                       // DB row -> JSON shape used by the React app
    return ['id' => (int)$r['id'], 'player' => $r['player'], 'set' => (int)$r['set_no'], 'type' => $r['type'],
        'speed' => (float)$r['speed'], 'bx' => (float)$r['bx'], 'by' => (float)$r['by'], 'half' => $r['half'],
        'box' => $r['box'], 'call' => $r['call_'], 'decision' => $r['decision'], 'margin' => (int)$r['margin'],
        'challenged' => (bool)$r['challenged'], 'overturned' => (bool)$r['overturned']];
}
function insertShots($db, $shots) {      // accepts one shot or a batch (arrays + loops)
    $st = $db->prepare("INSERT INTO shots (player,set_no,type,speed,bx,by,half,box,call_,decision,margin,challenged,overturned)
                        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)");
    $db->beginTransaction();
    foreach ($shots as $s) {
        $st->execute([$s['player'], $s['set'], $s['type'], $s['speed'], $s['bx'], $s['by'], $s['half'], $s['box'],
            $s['call'], $s['decision'], $s['margin'], $s['challenged'] ? 1 : 0, $s['overturned'] ? 1 : 0]);
    }
    $db->commit();
}

$method = $_SERVER['REQUEST_METHOD'];
$in = json_decode(file_get_contents('php://input'), true) ?? [];
try {
    if ($method === 'GET') {
        echo json_encode(array_map('fmt', $db->query("SELECT * FROM shots ORDER BY id")->fetchAll(PDO::FETCH_ASSOC)));
    } elseif ($method === 'POST') {
        insertShots($db, isset($in[0]) ? $in : [$in]);
        echo json_encode(['ok' => true]);
    } elseif ($method === 'DELETE') {
        if (isset($_GET['id'])) $db->prepare("DELETE FROM shots WHERE id=?")->execute([(int)$_GET['id']]);
        else $db->exec("DELETE FROM shots");
        echo json_encode(['ok' => true]);
    } else { http_response_code(405); echo json_encode(['error' => 'Method not allowed']); }
} catch (Exception $e) { http_response_code(500); echo json_encode(['error' => $e->getMessage()]); }
