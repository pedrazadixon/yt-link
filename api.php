<?php

header('Access-Control-Allow-Origin: *');
header('Content-Type: application/json');

include_once 'foreign_chars.php';

if (!isset($_GET['q']))
    exit(json_encode(['error' => 'no url']));

$q = urldecode($_GET['q']);

    $array_from = array_keys($foreign_characters);
    $array_to = array_values($foreign_characters);
    $str =  preg_replace($array_from, $array_to, $dee_track_info["title"] . ' - ' . $dee_track_info["artist"]["name"]);

if (preg_match('/^https?:\/\//', $q)) {
    $cmd = 'youtube-dl -f bestaudio --geo-bypass --get-url "' . $q . '" ';
$array_from = array_keys($foreign_characters);
$array_to = array_values($foreign_characters);
$q =  preg_replace($array_from, $array_to, $q);

    $cmd = 'youtube-dl -f bestaudio --geo-bypass --get-url "ytsearch1:' . $q . ' music" ';
}

$shell = trim(shell_exec($cmd));

if (empty($shell))
    exit(json_encode(['error' => 'can\'t get audio from url']));

exit(json_encode(['success' => $shell]));
